from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.routers.analytics_router import router as analytics_router
from app.routers.vault_documents import router as vault_documents_router
from app.core.database import get_db
from app.models.vault import VaultDocumentAudit, VaultDocument


def _analytics_app() -> FastAPI:
    app = FastAPI()
    app.include_router(analytics_router, prefix="/api/v1")
    return app


def _vault_app() -> FastAPI:
    app = FastAPI()
    app.include_router(vault_documents_router, prefix="/api/v1")
    return app


# ── ANALYTICS ROUTER TESTS ──────────────────────────────────────────

@patch("app.routers.analytics_router.get_conn")
def test_dashboard_kpis(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn

    # Setup database query mock return values
    mock_conn.fetchval.side_effect = [
        5,    # active_submissions
        12,   # open_gaps
        3,    # ha_pending
        85,   # avg_score
        100,  # total_docs
    ]
    mock_conn.fetch.return_value = [
        {"lifecycle_state": "draft", "count": 20},
        {"lifecycle_state": "in_review", "count": 80},
    ]

    client = TestClient(_analytics_app())
    response = client.get("/api/v1/analytics/dashboard-kpis")
    assert response.status_code == 200
    data = response.json()
    assert data["active_submissions"] == 5
    assert data["open_critical_gaps"] == 12
    assert data["ha_queries_pending"] == 3
    assert data["avg_compliance_score"] == 85
    assert data["total_vault_documents"] == 100
    assert data["documents_by_state"] == {"draft": 20, "in_review": 80}


@patch("app.routers.analytics_router.get_conn")
def test_compliance_by_agent(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn

    mock_conn.fetch.return_value = [
        {
            "scan_type": "schedule_y",
            "avg_score": 75,
            "scan_count": 4,
            "compliant_count": 2,
            "needs_revision_count": 1,
            "non_compliant_count": 1,
        }
    ]

    client = TestClient(_analytics_app())
    response = client.get("/api/v1/analytics/compliance-by-agent")
    assert response.status_code == 200
    data = response.json()
    assert "frameworks" in data
    assert len(data["frameworks"]) == 1
    assert data["frameworks"][0]["agent_type"] == "schedule_y"
    assert data["frameworks"][0]["display_name"] == "Schedule Y Check"
    assert data["frameworks"][0]["avg_score"] == 75


@patch("app.routers.analytics_router.get_conn")
def test_submission_throughput(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn

    mock_conn.fetch.return_value = [
        {
            "month_label": "Jun 2026",
            "total": 10,
            "approved": 4,
            "in_progress": 6,
        }
    ]

    client = TestClient(_analytics_app())
    response = client.get("/api/v1/analytics/submission-throughput")
    assert response.status_code == 200
    data = response.json()
    assert "monthly_data" in data
    assert len(data["monthly_data"]) == 1
    assert data["monthly_data"][0]["month"] == "Jun 2026"
    assert data["monthly_data"][0]["total"] == 10


@patch("app.routers.analytics_router.get_conn")
def test_recent_activity(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn

    dt = datetime(2026, 6, 14, 12, 0, 0, tzinfo=timezone.utc)

    # Mock doc_audit, agent_runs, and correspondence
    mock_conn.fetch.side_effect = [
        [  # doc_audit
            {
                "id": "1",
                "action": "uploaded",
                "user_name": "Anika Sharma",
                "user_initials": "AS",
                "from_state": None,
                "to_state": "draft",
                "note": "Uploaded IB",
                "created_at": dt,
                "document_title": "Investigator Brochure",
                "doc_number": "DOC-001",
            }
        ],
        [  # agent_runs
            {
                "id": "2",
                "agent_id": "completeness",
                "agent_name": "Completeness Check",
                "status": "completed",
                "created_at": dt,
                "input_snippet": "Completeness run",
                "compliance_score": 90.0,
            }
        ],
        [  # correspondence
            {
                "id": "3",
                "number": "CDSCO-Q-2026-001",
                "subject": "Deficiency Clarification",
                "direction": "inbound",
                "authority": "CDSCO",
                "state": "open",
                "priority": "high",
                "created_at": dt,
            }
        ],
    ]

    client = TestClient(_analytics_app())
    response = client.get("/api/v1/analytics/recent-activity")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["activities"]) == 3
    
    # Assert unified activities properties
    types = [act["type"] for act in data["activities"]]
    assert "document" in types
    assert "agent_run" in types
    assert "correspondence" in types


# ── VAULT AUDIT TRAIL TESTS ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_vault_audit_trail() -> None:
    mock_session = AsyncMock(spec=AsyncSession)
    
    # Mock return values for SQLAlchemy query
    mock_entry = MagicMock(spec=VaultDocumentAudit)
    mock_entry.id = "audit-1"
    mock_entry.document_id = "doc-1"
    mock_entry.action = "state_transition"
    mock_entry.from_state = "draft"
    mock_entry.to_state = "in_review"
    mock_entry.user_name = "Anika Sharma"
    mock_entry.user_initials = "AS"
    mock_entry.note = "Ready for review"
    mock_entry.created_at = datetime(2026, 6, 14, 10, 0, 0, tzinfo=timezone.utc)
    
    # Mock document relationship
    mock_doc = MagicMock(spec=VaultDocument)
    mock_doc.title = "Test Protocol"
    mock_doc.doc_number = "DOC-101"
    mock_entry.document = mock_doc

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_entry]
    mock_session.execute.return_value = mock_result

    app = _vault_app()
    app.dependency_overrides[get_db] = lambda: mock_session

    client = TestClient(app)
    response = client.get("/api/v1/vault/documents/audit-trail?workspace_id=ws-1")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["audit_trail"][0]["action"] == "state_transition"
    assert data["audit_trail"][0]["document_title"] == "Test Protocol"
    assert data["audit_trail"][0]["doc_number"] == "DOC-101"
