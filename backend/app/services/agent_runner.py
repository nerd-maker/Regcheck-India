# backend/app/services/agent_runner.py
"""
Direct Python wrappers for the 5 compliance agents used by auto-scan.

Instead of calling agents via loopback HTTP (httpx → localhost → FastAPI →
agents_router), these functions call the Claude API directly in-process.
This is the correct architecture for a single-worker Render deployment:
  - No network overhead, no port dependencies
  - No risk of the server not yet listening when a background task starts
  - No possibility of hitting rate-limiter middleware on self-calls

Each function accepts ``extracted_text: str`` and returns the inner
``result`` dict — exactly the same shape that ``_extract_agent_results()``
in compliance_scan_service.py already expects (i.e. the unwrapped inner
Claude output, not the full AgentResponse wrapper).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

# Import shared utilities from the leaf module app.services.agent_utils.
# This breaks the circular import that would occur if we imported from
# agents_router.py (which itself imports from app/services/).
from app.services.claude_client import (
    call_claude_agent as call_claude,
    structure_prompt_input,
    AgentResponse,
)
from app.services.agent_utils import (
    retrieve_regulatory_context,
    MODEL_HAIKU,
    MODEL_SONNET,
    AGENT_01_SYSTEM_PROMPT,
    AGENT_03_SYSTEM_PROMPT,
    AGENT_03_SAE_SYSTEM_PROMPT,
    AGENT_04_SYSTEM_PROMPT,
    AGENT_07_SYSTEM_PROMPT,
    AGENT_08_SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)


def _internal_agent_key() -> str:
    key = os.getenv("ADMIN_DEMO_KEY", "")
    if not key:
        raise RuntimeError("ADMIN_DEMO_KEY must be set for internal agent jobs.")
    return key

# ---------------------------------------------------------------------------
# Shared helper
# ---------------------------------------------------------------------------

def _unwrap_result(agent_response: Any) -> dict[str, Any]:
    """Return the inner ``result`` dict from an AgentResponse object."""
    result = getattr(agent_response, "result", None)
    if isinstance(result, dict):
        return result
    return {}


# ---------------------------------------------------------------------------
# Agent 01 — PII / PHI Anonymisation
# ---------------------------------------------------------------------------

async def run_pii_anonymiser(extracted_text: str, doc_type: str = "clinical_document") -> dict[str, Any]:
    """
    Run the PII anonymisation agent against ``extracted_text``.

    Returns the inner result dict (entities_detected, anonymisation_report, …).
    """
    structured = structure_prompt_input(extracted_text, doc_type, "M1_PII_ANONYMISER")
    try:
        agent_response = await call_claude(
            agent_name="PII_PHI_Anonymisation",
            model=MODEL_HAIKU,
            system_prompt=AGENT_01_SYSTEM_PROMPT,
            user_content=f"Document metadata: {json.dumps({'source': 'vault_auto_scan'})}\n\nDocument:\n{structured}",
            api_key=_internal_agent_key(),
            max_tokens=4096,
            has_rag_context=False,
        )
        return _unwrap_result(agent_response)
    except Exception as exc:
        logger.error("run_pii_anonymiser failed: %s", exc)
        raise


# ---------------------------------------------------------------------------
# Agent 03 — Completeness Assessment
# ---------------------------------------------------------------------------

async def run_completeness(extracted_text: str, doc_type: str = "GENERAL") -> dict[str, Any]:
    """
    Run the completeness assessment agent against ``extracted_text``.

    Returns the inner result dict (overall_completeness_score, critical_gaps, …).
    doc_type should be the vault doc_type string (e.g. "Protocol", "ICF", "SAE_REPORT").
    """
    # Select the SAE-specific prompt when appropriate
    if doc_type in ("SAE Narrative", "SAE_REPORT"):
        system_prompt = AGENT_03_SAE_SYSTEM_PROMPT
        agent_name = "SAE_Report_Completeness"
        completeness_doc_type = "SAE_REPORT"
    else:
        system_prompt = AGENT_03_SYSTEM_PROMPT
        agent_name = "Completeness_Assessment"
        completeness_doc_type = doc_type or "GENERAL"

    rag_query = f"completeness requirements {completeness_doc_type} CDSCO NDCTR Schedule Y ICH"
    regulatory_context = retrieve_regulatory_context(rag_query, n_results=5)

    if regulatory_context:
        rag_section = (
            "\n\n[RETRIEVED REGULATORY CONTEXT — from official documents]\n"
            "The following excerpts are retrieved from official regulatory documents. "
            "Use these to ground your completeness assessment:\n\n"
            f"{regulatory_context}\n\n[END OF RETRIEVED CONTEXT]\n"
        )
    else:
        rag_section = "\n[Note: Use your built-in knowledge of NDCTR 2019, Schedule Y, and ICH guidelines]\n"

    structured = structure_prompt_input(extracted_text, "submission_document", "M3_COMPLETENESS_ASSESSOR")
    prompt = (
        f"Assess completeness of this document:{rag_section}\n"
        f"Document metadata: {json.dumps({'source': 'vault_auto_scan', 'document_type': completeness_doc_type})}\n\n"
        f"Document:\n{structured}"
    )

    try:
        agent_response = await call_claude(
            agent_name=agent_name,
            model=MODEL_SONNET,
            system_prompt=system_prompt,
            user_content=prompt,
            api_key=_internal_agent_key(),
            max_tokens=4096,
            has_rag_context=bool(regulatory_context),
        )
        return _unwrap_result(agent_response)
    except Exception as exc:
        logger.error("run_completeness failed: %s", exc)
        raise


# ---------------------------------------------------------------------------
# Agent 04 — SAE Case Classification
# ---------------------------------------------------------------------------

async def run_sae_classifier(extracted_text: str, doc_type: str = "sae_narrative") -> dict[str, Any]:
    """
    Run the SAE case classifier against ``extracted_text``.

    Returns the inner result dict (primary_category, confidence, flags, …).
    """
    structured = structure_prompt_input(extracted_text, "sae_narrative", "M4_CASE_CLASSIFIER")
    try:
        agent_response = await call_claude(
            agent_name="Case_Classification",
            model=MODEL_HAIKU,
            system_prompt=AGENT_04_SYSTEM_PROMPT,
            user_content=f"Case metadata: {json.dumps({'source': 'vault_auto_scan'})}\n\nCase narrative:\n{structured}",
            api_key=_internal_agent_key(),
            max_tokens=4096,
            has_rag_context=False,
        )
        return _unwrap_result(agent_response)
    except Exception as exc:
        logger.error("run_sae_classifier failed: %s", exc)
        raise


# ---------------------------------------------------------------------------
# Agent 07 — Schedule Y Compliance
# ---------------------------------------------------------------------------

async def run_schedule_y(extracted_text: str, doc_type: str = "clinical_protocol") -> dict[str, Any]:
    """
    Run the Schedule Y compliance agent against ``extracted_text``.

    Returns the inner result dict (compliance_score, critical_non_compliances, …).
    """
    rag_query = "Schedule Y requirements clinical trial NDCTR 2019 CDSCO compliance checklist appendix"
    regulatory_context = retrieve_regulatory_context(rag_query, n_results=6)

    if regulatory_context:
        rag_section = (
            "\n\n[RETRIEVED REGULATORY CONTEXT — Schedule Y & NDCTR 2019 Official Documents]\n"
            "The following excerpts are retrieved directly from Schedule Y and NDCTR 2019. "
            "Use these as the authoritative source for your compliance assessment:\n\n"
            f"{regulatory_context}\n\n[END OF RETRIEVED CONTEXT]\n"
        )
    else:
        rag_section = "\n[Note: Use your built-in knowledge of Schedule Y and NDCTR 2019]\n"

    structured = structure_prompt_input(extracted_text, "clinical_protocol", "M7_SCHEDULE_Y")
    prompt = (
        f"Perform Schedule Y compliance assessment:{rag_section}\n"
        f"Document metadata: {json.dumps({'source': 'vault_auto_scan'})}\n\n"
        f"Document:\n{structured}"
    )

    try:
        agent_response = await call_claude(
            agent_name="Schedule_Y_Compliance",
            model=MODEL_SONNET,
            system_prompt=AGENT_07_SYSTEM_PROMPT,
            user_content=prompt,
            api_key=_internal_agent_key(),
            max_tokens=4096,
            has_rag_context=bool(regulatory_context),
        )
        return _unwrap_result(agent_response)
    except Exception as exc:
        logger.error("run_schedule_y failed: %s", exc)
        raise


# ---------------------------------------------------------------------------
# Agent 08 — ICH E6(R3) GCP Compliance
# ---------------------------------------------------------------------------

async def run_ich_gcp(extracted_text: str, doc_type: str = "gcp_document") -> dict[str, Any]:
    """
    Run the ICH E6(R3) GCP compliance agent against ``extracted_text``.

    Returns the inner result dict (gcp_score, critical_deviations, …).
    """
    rag_query = "ICH E6 R3 GCP good clinical practice quality management risk based monitoring"
    regulatory_context = retrieve_regulatory_context(rag_query, n_results=6)

    if regulatory_context:
        rag_section = (
            "\n\n[RETRIEVED REGULATORY CONTEXT — ICH E6(R3) Official Document]\n"
            "The following excerpts are retrieved directly from ICH E6(R3) final guidelines. "
            "Use these as the authoritative source for your GCP assessment:\n\n"
            f"{regulatory_context}\n\n[END OF RETRIEVED CONTEXT]\n"
        )
    else:
        rag_section = "\n[Note: Use your built-in knowledge of ICH E6(R3) GCP guidelines]\n"

    structured = structure_prompt_input(extracted_text, "gcp_document", "M8_ICH_GCP")
    prompt = (
        f"Perform ICH E6(R3) GCP compliance assessment:{rag_section}\n"
        f"Document metadata: {json.dumps({'source': 'vault_auto_scan'})}\n\n"
        f"Document:\n{structured}"
    )

    try:
        agent_response = await call_claude(
            agent_name="ICH_GCP_Compliance",
            model=MODEL_SONNET,
            system_prompt=AGENT_08_SYSTEM_PROMPT,
            user_content=prompt,
            api_key=_internal_agent_key(),
            max_tokens=4096,
            has_rag_context=bool(regulatory_context),
        )
        return _unwrap_result(agent_response)
    except Exception as exc:
        logger.error("run_ich_gcp failed: %s", exc)
        raise
