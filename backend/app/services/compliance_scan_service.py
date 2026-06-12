# backend/app/services/compliance_scan_service.py
"""
Auto-scan service for the Document Vault Engine.

When a document transitions to ``in_review``, this service:
1. Creates pending ``VaultComplianceScan`` rows (one per relevant agent).
2. Calls each compliance agent directly via Python import (no HTTP).
3. Writes the score and findings back to ``vault_compliance_scans``.

The function ``trigger_auto_scan`` is designed to run as a FastAPI
``BackgroundTasks`` job — it manages its own DB sessions via
``get_async_session()``.

Architecture note: agents are called in-process via ``agent_runner``
functions, not via loopback HTTP. This is the correct approach for a
single-worker Render deployment — no port dependencies, no network
overhead, and no risk of self-calling a not-yet-listening server.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import select, update

from app.core.database import get_async_session
from app.models.vault import VaultComplianceScan, VaultDocument
from app.services.agent_runner import (
    run_pii_anonymiser,
    run_completeness,
    run_sae_classifier,
    run_schedule_y,
    run_ich_gcp,
)

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

# Agent type → runner function (direct in-process call, no HTTP)
# cross_doc requires file uploads and cannot be called via text alone.
AGENT_RUNNERS: dict[str, Any] = {
    "schedule_y":     run_schedule_y,
    "ich_e6r3":       run_ich_gcp,
    "completeness":   run_completeness,
    "pii_anonymiser": run_pii_anonymiser,
    "sae_classifier": run_sae_classifier,
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
# Run one agent scan — direct in-process Python call
# ---------------------------------------------------------------------------

async def _run_single_agent_scan(
    document_id: str,
    agent_type: str,
    scan_id: str,
    extracted_text: str,
    doc_type: str,
) -> None:
    """Call one compliance agent directly via Python import and write results back.

    No HTTP, no httpx, no localhost. The agent runner functions live in
    app/services/agent_runner.py and call Claude in-process.
    """
    runner = AGENT_RUNNERS.get(agent_type)

    # cross_doc requires file uploads — return graceful failure
    if runner is None:
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

    try:
        # Call the agent function directly — returns the inner result dict
        inner_result: dict[str, Any] = await runner(
            extracted_text=extracted_text,
            doc_type=doc_type,
        )

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

    except Exception as exc:
        logger.error(
            "agent_scan_error agent_type=%s scan_id=%s error=%s",
            agent_type, scan_id, str(exc),
        )
        await _write_scan_result(
            scan_id=scan_id,
            status="failed",
            score=None,
            findings=[f"Agent error: {exc}"],
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
