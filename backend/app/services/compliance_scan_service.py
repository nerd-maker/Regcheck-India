# backend/app/services/compliance_scan_service.py
"""
Auto-scan service for the Document Vault Engine.

When a document transitions to ``in_review``, this service:
1. Creates pending ``VaultComplianceScan`` rows (one per relevant agent).
2. Calls each agent via loopback HTTP on the same FastAPI process.
3. Writes the score and findings back to ``vault_compliance_scans``.

The function ``trigger_auto_scan`` is designed to run as a FastAPI
``BackgroundTasks`` job — it manages its own DB sessions via
``get_async_session()``.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.database import get_async_session
from app.models.vault import VaultComplianceScan, VaultDocument

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Agent-to-document-type mapping
# ---------------------------------------------------------------------------

AGENT_MAP: dict[str, list[str]] = {
    "Protocol":          ["schedule_y", "ich_e6r3", "completeness", "cross_doc"],
    "ICF":               ["schedule_y", "completeness", "pii_anonymiser"],
    "IB":                ["completeness", "cross_doc"],
    "CSR":               ["completeness", "cross_doc", "ich_e6r3"],
    "SAE Narrative":     ["sae_classifier", "pii_anonymiser"],
    "Cover Letter":      ["completeness"],
    "CTRI":              ["schedule_y", "completeness"],
    "Inspection Report": ["completeness"],
    "SOP":               ["completeness"],
    "Other":             ["completeness"],
}

DEFAULT_AGENTS: list[str] = ["completeness"]

# Agent type → actual backend endpoint path (relative to base URL)
# The agents router is mounted at /api/v1/agents in main.py.
AGENT_ENDPOINTS: dict[str, str | None] = {
    "schedule_y":     "/api/v1/agents/schedule-y",
    "ich_e6r3":       "/api/v1/agents/ich-gcp",
    "completeness":   "/api/v1/agents/completeness",
    "pii_anonymiser": "/api/v1/agents/anonymise",
    "sae_classifier": "/api/v1/agents/classify",
    "cross_doc":      None,  # requires file uploads — not callable via text
}


def get_agents_for_doc_type(doc_type: Optional[str]) -> list[str]:
    """Return the list of agent IDs to run for a given document type."""
    if not doc_type:
        return DEFAULT_AGENTS
    return AGENT_MAP.get(doc_type, DEFAULT_AGENTS)


# ---------------------------------------------------------------------------
# Per-agent result extraction — explicit field mapping per Check 2 findings
# ---------------------------------------------------------------------------

def _extract_agent_results(
    agent_type: str, result: dict[str, Any]
) -> tuple[int | None, list[Any]]:
    """Extract score (int 0–100 or None) and findings (list) from agent output.

    ``result`` is the value of ``response_json["result"]`` — the inner Claude
    output dict, after the AgentResponse wrapper has been unwrapped.
    """
    if agent_type == "schedule_y":
        # result.compliance_score is float 0–100
        raw = result.get("compliance_score")
        score = round(float(raw)) if raw is not None else None
        findings: list[Any] = (
            result.get("critical_non_compliances", [])
            + result.get("major_non_compliances", [])
            + result.get("minor_non_compliances", [])
        )
        return score, findings

    if agent_type == "ich_e6r3":
        # result.gcp_score is float 0–100
        raw = result.get("gcp_score")
        score = round(float(raw)) if raw is not None else None
        findings = (
            result.get("critical_deviations", [])
            + result.get("major_deviations", [])
            + result.get("minor_deviations", [])
        )
        return score, findings

    if agent_type == "completeness":
        # result.overall_completeness_score is float 0.0–1.0
        raw = result.get("overall_completeness_score")
        if raw is not None:
            f = float(raw)
            score = round(f * 100) if f <= 1.0 else round(f)
        else:
            score = None
        findings = (
            result.get("critical_gaps", [])
            + result.get("minor_gaps", [])
            + result.get("missing_sections", [])
        )
        return score, findings

    if agent_type == "pii_anonymiser":
        # No compliance percentage — entities_anonymised is a count.
        # Score stays None (PII detection is pass/informational, not a %).
        entities = result.get("entities_detected", [])
        findings = [
            f"{e.get('entity_type', 'UNKNOWN')}: {e.get('value', '???')} ({e.get('category', '')})"
            for e in entities[:20]
        ]
        report = result.get("anonymisation_report", {})
        if isinstance(report, dict) and report.get("summary"):
            findings.insert(0, report["summary"])
        return None, findings

    if agent_type == "sae_classifier":
        # result.confidence is float 0.0–1.0
        raw = result.get("confidence")
        score = round(float(raw) * 100) if raw is not None else None
        findings = (
            result.get("flags", [])
            + result.get("regulatory_actions_required", [])
        )
        primary = result.get("primary_category")
        if primary:
            findings.insert(0, f"Classification: {primary}")
        return score, findings

    # Fallback — unknown agent type
    return None, [f"No field mapping for agent type: {agent_type}"]


# ---------------------------------------------------------------------------
# Build the correct request body per agent
# ---------------------------------------------------------------------------

def _build_request_body(agent_type: str, extracted_text: str, doc_type: str) -> dict[str, Any]:
    """Build the JSON body matching each agent's Pydantic request model."""
    if agent_type == "completeness":
        # CompletenessRequest(document, metadata, document_type)
        return {
            "document": extracted_text,
            "metadata": {"source": "vault_auto_scan"},
            "document_type": doc_type or "GENERAL",
        }
    # All other agents use AgentRequest(document, metadata)
    return {
        "document": extracted_text,
        "metadata": {"source": "vault_auto_scan"},
    }


# ---------------------------------------------------------------------------
# Main entry point — called as a FastAPI BackgroundTasks job
# ---------------------------------------------------------------------------

async def trigger_auto_scan(document_id: str, doc_type: Optional[str]) -> None:
    """Background task: run compliance agents when a doc moves to in_review.

    Creates its own DB sessions (the request session is already committed).
    """
    agents = get_agents_for_doc_type(doc_type)
    logger.info("auto_scan_triggered document_id=%s agents=%s", document_id, agents)

    # ── 1. Get extracted text from vault_documents ────────────────────────
    async with get_async_session() as db:
        result = await db.execute(
            select(VaultDocument.extracted_text)
            .where(VaultDocument.id == document_id)
        )
        row = result.one_or_none()

        if not row:
            logger.error("auto_scan_no_document document_id=%s", document_id)
            return

        extracted_text: str | None = row[0]

        if not extracted_text:
            logger.warning("auto_scan_no_text document_id=%s", document_id)
            # Create failed scan records with clear message
            for agent_type in agents:
                scan = VaultComplianceScan(
                    document_id=document_id,
                    scan_type=agent_type,
                    status="failed",
                    findings=["No extractable text found in document. Upload a text-based PDF or DOCX."],
                )
                db.add(scan)
            # commit handled by context manager
            return

        # ── 2. Create "running" scan records so the UI shows progress ─────
        scan_ids: dict[str, str] = {}
        for agent_type in agents:
            scan = VaultComplianceScan(
                document_id=document_id,
                scan_type=agent_type,
                status="running",
                findings=[],
            )
            db.add(scan)
            await db.flush()  # assigns the id
            scan_ids[agent_type] = scan.id

        # commit handled by context manager

    # ── 3. Run each agent (each in its own session to avoid long txn) ─────
    for agent_type in agents:
        await _run_single_agent_scan(
            document_id=document_id,
            agent_type=agent_type,
            scan_id=scan_ids[agent_type],
            extracted_text=extracted_text,
            doc_type=doc_type or "Other",
        )


# ---------------------------------------------------------------------------
# Run one agent scan via loopback HTTP
# ---------------------------------------------------------------------------

async def _run_single_agent_scan(
    document_id: str,
    agent_type: str,
    scan_id: str,
    extracted_text: str,
    doc_type: str,
) -> None:
    """Call one compliance agent via internal loopback and write results back."""
    endpoint = AGENT_ENDPOINTS.get(agent_type)

    # cross_doc requires file uploads — return graceful failure
    if endpoint is None:
        await _write_scan_result(
            scan_id=scan_id,
            status="failed",
            score=None,
            findings=[
                "Cross-document check requires multiple uploaded documents. "
                "Run this agent manually from the Compliance Actions panel with "
                "2–5 documents selected."
            ],
        )
        return

    settings = get_settings()
    port = settings.backend_port
    base_url = f"http://localhost:{port}"
    body = _build_request_body(agent_type, extracted_text, doc_type)

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{base_url}{endpoint}",
                json=body,
                headers={"x-anthropic-api-key": "admin-regcheck"},
            )
            response.raise_for_status()
            response_json = response.json()

        # AgentResponse wraps the actual output in "result"
        inner_result = response_json.get("result", {})
        if not isinstance(inner_result, dict):
            inner_result = {}

        score, findings = _extract_agent_results(agent_type, inner_result)

        await _write_scan_result(
            scan_id=scan_id,
            status="completed",
            score=score,
            findings=findings,
        )
        logger.info(
            "agent_scan_completed agent_type=%s scan_id=%s score=%s",
            agent_type, scan_id, score,
        )

    except httpx.TimeoutException:
        logger.error("agent_scan_timeout agent_type=%s scan_id=%s", agent_type, scan_id)
        await _write_scan_result(
            scan_id=scan_id,
            status="failed",
            score=None,
            findings=["Agent timed out after 120 seconds."],
        )
    except httpx.HTTPStatusError as e:
        logger.error(
            "agent_scan_http_error agent_type=%s status=%s", agent_type, e.response.status_code,
        )
        await _write_scan_result(
            scan_id=scan_id,
            status="failed",
            score=None,
            findings=[f"Agent returned HTTP {e.response.status_code}"],
        )
    except Exception as e:
        logger.error("agent_scan_unexpected_error agent_type=%s error=%s", agent_type, str(e))
        await _write_scan_result(
            scan_id=scan_id,
            status="failed",
            score=None,
            findings=[str(e)],
        )


async def _write_scan_result(
    scan_id: str,
    status: str,
    score: int | None,
    findings: list[Any],
) -> None:
    """Write final scan result back to vault_compliance_scans."""
    async with get_async_session() as db:
        await db.execute(
            update(VaultComplianceScan)
            .where(VaultComplianceScan.id == scan_id)
            .values(
                status=status,
                score=score,
                findings=findings,
            )
        )
        # commit handled by context manager
