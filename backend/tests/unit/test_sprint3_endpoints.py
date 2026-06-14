from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers.submissions_router import router as submissions_router
from app.routers.correspondence_router import router as correspondence_router


def _submissions_app() -> FastAPI:
    app = FastAPI()
    app.include_router(submissions_router, prefix="/api/v1")
    return app


def _correspondence_app() -> FastAPI:
    app = FastAPI()
    app.include_router(correspondence_router, prefix="/api/v1")
    return app


# ── SUBMISSIONS TESTS ───────────────────────────────────────────────

@patch("app.routers.submissions_router.get_conn")
def test_list_submissions(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.fetch.return_value = [
        {
            "id": "s-1",
            "number": "SUB-2026-001",
            "name": "Test Submission",
            "type": "IND",
            "product": "Test Product",
            "indication": "Diabetes",
            "state": "draft",
            "state_label": "Draft",
            "ha_authority": "CDSCO",
            "phase": "Phase II",
            "owner_id": "p1",
            "owner_name": "Anika Sharma",
            "owner_initials": "AS",
            "owner_role": "Regulatory Lead",
            "target_submit_date": "2026-07-15",
            "risk_level": "medium",
            "documents": 0,
            "open_gaps": 0,
            "compliance_score": 0,
            "frameworks": '["Schedule Y"]',
            "application_id": None,
            "updated_at": "just now",
            "created_at": None,
        }
    ]
    
    client = TestClient(_submissions_app())
    response = client.get("/api/v1/submissions")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["submissions"][0]["name"] == "Test Submission"
    assert data["submissions"][0]["frameworks"] == ["Schedule Y"]


@patch("app.routers.submissions_router.get_conn")
def test_create_submission(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.fetchval.return_value = 0
    mock_conn.fetchrow.return_value = {
        "id": "s-new",
        "number": "SUB-2026-001",
        "name": "New Submission",
        "type": "IND",
        "product": "Product",
        "indication": "Indication",
        "state": "draft",
        "state_label": "Draft",
        "ha_authority": "CDSCO",
        "phase": "Phase II",
        "owner_id": "p1",
        "owner_name": "Anika Sharma",
        "owner_initials": "AS",
        "owner_role": "Regulatory Lead",
        "target_submit_date": "2026-07-15",
        "risk_level": "medium",
        "documents": 0,
        "open_gaps": 0,
        "compliance_score": 0,
        "frameworks": '["Schedule Y"]',
        "application_id": None,
        "updated_at": "just now",
        "created_at": None,
    }

    client = TestClient(_submissions_app())
    payload = {
        "name": "New Submission",
        "type": "IND",
        "phase": "Phase II",
        "product": "Product",
        "indication": "Indication",
        "ha_authority": "CDSCO",
        "target_submit_date": "2026-07-15",
        "owner_name": "Anika Sharma",
        "owner_initials": "AS",
        "owner_role": "Regulatory Lead",
        "risk_level": "medium",
        "frameworks": ["Schedule Y"]
    }
    response = client.post("/api/v1/submissions", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "s-new"
    assert data["number"] == "SUB-2026-001"


@patch("app.routers.submissions_router.get_conn")
def test_get_submission_detail(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.fetchrow.return_value = {
        "id": "s-1",
        "number": "SUB-2026-001",
        "name": "Test Submission",
        "type": "IND",
        "product": "Product",
        "indication": "Indication",
        "state": "draft",
        "state_label": "Draft",
        "ha_authority": "CDSCO",
        "phase": "Phase II",
        "owner_id": "p1",
        "owner_name": "Anika Sharma",
        "owner_initials": "AS",
        "owner_role": "Regulatory Lead",
        "target_submit_date": "2026-07-15",
        "risk_level": "medium",
        "documents": 0,
        "open_gaps": 0,
        "compliance_score": 0,
        "frameworks": '["Schedule Y"]',
        "application_id": None,
        "updated_at": "just now",
        "created_at": None,
    }

    client = TestClient(_submissions_app())
    response = client.get("/api/v1/submissions/s-1")
    assert response.status_code == 200
    assert response.json()["id"] == "s-1"

    # Test not found
    mock_conn.fetchrow.return_value = None
    response = client.get("/api/v1/submissions/s-invalid")
    assert response.status_code == 404


@patch("app.routers.submissions_router.get_conn")
def test_update_submission(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.fetchrow.side_effect = [
        {"id": "s-1"},  # check existence
        {
            "id": "s-1",
            "number": "SUB-2026-001",
            "name": "Updated Submission",
            "type": "IND",
            "product": "Product",
            "indication": "Indication",
            "state": "review",
            "state_label": "In Review",
            "ha_authority": "CDSCO",
            "phase": "Phase II",
            "owner_id": "p1",
            "owner_name": "Anika Sharma",
            "owner_initials": "AS",
            "owner_role": "Regulatory Lead",
            "target_submit_date": "2026-07-15",
            "risk_level": "medium",
            "documents": 0,
            "open_gaps": 0,
            "compliance_score": 0,
            "frameworks": '["Schedule Y"]',
            "application_id": None,
            "updated_at": "just now",
            "created_at": None,
        }  # fetch row updated
    ]

    client = TestClient(_submissions_app())
    response = client.patch("/api/v1/submissions/s-1", json={"name": "Updated Submission", "state": "review"})
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Submission"


@patch("app.routers.submissions_router.get_conn")
def test_delete_submission(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.fetchrow.return_value = {"id": "s-1"}

    client = TestClient(_submissions_app())
    response = client.delete("/api/v1/submissions/s-1")
    assert response.status_code == 204


def test_compliance_summary() -> None:
    client = TestClient(_submissions_app())
    response = client.get("/api/v1/submissions/s-1/compliance-summary")
    assert response.status_code == 200
    data = response.json()
    assert data["submission_id"] == "s-1"
    assert data["linked_documents"] == 0
    assert data["avg_compliance_score"] is None
    assert "Sprint 4" in data["note"]


# ── CORRESPONDENCE TESTS ────────────────────────────────────────────

@patch("app.routers.correspondence_router.get_conn")
def test_list_correspondence(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.fetch.return_value = [
        {
            "id": "h-1",
            "number": "HA-2026-001",
            "subject": "Test Query",
            "direction": "inbound",
            "authority": "CDSCO",
            "category": "Query",
            "submission_id": "s-1",
            "received_at": "2026-06-13",
            "due_at": "2026-06-20",
            "state": "open",
            "priority": "standard",
            "preview": "Test preview",
            "created_at": None
        }
    ]

    client = TestClient(_correspondence_app())
    response = client.get("/api/v1/correspondence")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["open_count"] == 1
    assert data["correspondence"][0]["subject"] == "Test Query"


@patch("app.routers.correspondence_router.get_conn")
def test_create_correspondence(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.fetchval.return_value = 0
    mock_conn.fetchrow.return_value = {
        "id": "h-new",
        "number": "HA-2026-001",
        "subject": "New Query",
        "direction": "inbound",
        "authority": "CDSCO",
        "category": "Query",
        "submission_id": "s-1",
        "received_at": "2026-06-13",
        "due_at": "2026-06-20",
        "state": "open",
        "priority": "standard",
        "preview": "Test preview",
        "created_at": None
    }

    client = TestClient(_correspondence_app())
    payload = {
        "subject": "New Query",
        "direction": "inbound",
        "authority": "CDSCO",
        "category": "Query",
        "submission_id": "s-1",
        "received_at": "2026-06-13",
        "due_at": "2026-06-20",
        "priority": "standard",
        "preview": "Test preview"
    }
    response = client.post("/api/v1/correspondence", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "h-new"
    assert data["number"] == "HA-2026-001"


@patch("app.routers.correspondence_router.get_conn")
def test_get_correspondence_detail(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.fetchrow.return_value = {
        "id": "h-1",
        "number": "HA-2026-001",
        "subject": "Test Query",
        "direction": "inbound",
        "authority": "CDSCO",
        "category": "Query",
        "submission_id": "s-1",
        "received_at": "2026-06-13",
        "due_at": "2026-06-20",
        "state": "open",
        "priority": "standard",
        "preview": "Test preview",
        "created_at": None
    }

    client = TestClient(_correspondence_app())
    response = client.get("/api/v1/correspondence/h-1")
    assert response.status_code == 200
    assert response.json()["id"] == "h-1"


@patch("app.routers.correspondence_router.get_conn")
def test_update_correspondence_state(mock_get_conn: AsyncMock) -> None:
    mock_conn = AsyncMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.fetchrow.side_effect = [
        {"id": "h-1"},  # check existence
        {
            "id": "h-1",
            "number": "HA-2026-001",
            "subject": "Test Query",
            "direction": "inbound",
            "authority": "CDSCO",
            "category": "Query",
            "submission_id": "s-1",
            "received_at": "2026-06-13",
            "due_at": "2026-06-20",
            "state": "response-drafted",
            "priority": "standard",
            "preview": "Test preview",
            "created_at": None
        }  # fetch row updated
    ]

    client = TestClient(_correspondence_app())
    response = client.patch("/api/v1/correspondence/h-1/state", json={"state": "response-drafted"})
    assert response.status_code == 200
    assert response.json()["state"] == "response-drafted"
