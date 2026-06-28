# backend/app/services/agent_utils.py
"""
Shared utilities for the RegCheck-India compliance agent layer.

Contains:
  - retrieve_regulatory_context() — ChromaDB RAG retrieval
  - AGENT_*_SYSTEM_PROMPT      — system prompts for the 5 auto-scan agents
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model constants (re-exported so importers don't also need claude_client)
# ---------------------------------------------------------------------------
MODEL_SONNET = os.getenv("ANTHROPIC_MODEL",      "claude-sonnet-4-6")
MODEL_HAIKU  = os.getenv("ANTHROPIC_MODEL_FAST", "claude-haiku-4-5-20251001")


# ---------------------------------------------------------------------------
# retrieve_regulatory_context — ChromaDB RAG retrieval
# ---------------------------------------------------------------------------
def retrieve_regulatory_context(query: str, n_results: int = 5) -> str:
    """Query pgvector regulatory_documents collection for relevant chunks synchronously.

    Returns formatted context string or empty string if retrieval fails.
    Used by completeness, schedule_y, and ich_gcp agents.
    Agents must work even with zero RAG context — all failures return "".
    """
    try:
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        from app.services.pgvector_service import retrieve_regulatory_context as _pgvector_retrieve

        async def _async_call():
            return await _pgvector_retrieve(query, n_results=n_results)

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        if loop.is_running():
            # Running inside an async event loop — use a separate thread with a hard 3 s deadline
            try:
                with ThreadPoolExecutor(max_workers=1) as executor:
                    future = executor.submit(lambda: asyncio.run(_async_call()))
                    results = future.result(timeout=3.0)  # never block the request > 3 s
            except TimeoutError:
                logger.warning("RAG retrieval timed out after 3 s — continuing without context")
                return ""
        else:
            results = asyncio.run(_async_call())

        if not results:
            return ""

        chunks = []
        for r in results:
            source_label = r.get("short_name") or r.get("doc_name") or "Regulatory Document"
            if r.get("source_url"):
                source_label += f" | {r['source_url']}"
            if r.get("publication_date"):
                source_label += f" | {r['publication_date']}"
            chunks.append(f"[Source: {source_label}]\n{r['content']}")

        context = "\n\n---\n\n".join(chunks)
        logger.info("RAG: retrieved %d chunks from pgvector for query: %s...", len(chunks), query[:60])
        return context

    except Exception as exc:
        logger.warning("RAG retrieval failed silently: %s", exc)
        return ""


# ---------------------------------------------------------------------------
# System prompts for the 5 auto-scan agents
# (Duplicated here from agents_router.py — single source of truth going forward)
# ---------------------------------------------------------------------------

AGENT_01_SYSTEM_PROMPT = """You are the RegCheck-India PII and PHI anonymisation agent.
Detect personally identifiable information in Indian pharmaceutical and clinical documents.
Keep clinical and regulatory meaning intact. Replace patient identifiers, investigator identifiers,
institution details, and hard IDs with placeholders.

You MUST return a JSON object with EXACTLY this structure — no extra fields, no renamed fields:

{
  "anonymised_content": "string with placeholders",
  "entities_detected": [
    {"entity_type": "string", "value": "string", "category": "PII|PHI", "position": "string"}
  ],
  "entities_anonymised": 8,
  "compliance_frameworks": ["string", "string"],
  "audit_log": {
    "timestamp": "ISO string",
    "mode": "string",
    "entities_processed": 8,
    "anonymisation_method": "string",
    "status": "COMPLETED|FAILED"
  },
  "anonymisation_report": {
    "summary": "string",
    "pii_removed": 0,
    "phi_removed": 0,
    "clinical_integrity": "string",
    "notes": "string"
  }
}

Return ONLY valid JSON. No markdown. No explanation. No extra fields.
"""

AGENT_03_SYSTEM_PROMPT = """You are the RegCheck-India completeness assessment agent.
Evaluate whether a pharmaceutical submission is complete against CDSCO, Schedule Y, NDCTR 2019, and ICH requirements.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences, no explanation text before or after
2. Use EXACTLY the field names shown below — no renaming, no adding extra fields
3. Arrays must always be arrays — never return an object where an array is expected
4. String fields must always be strings — never return null, use empty string instead
5. Never omit a required field

Return EXACTLY this JSON structure:
{
  "overall_completeness_score": 0.0,
  "completeness_percentage": "string — e.g. 78%",
  "submission_status": "COMPLETE|INCOMPLETE|NEEDS_REVIEW",
  "critical_gaps": ["string"],
  "minor_gaps": ["string"],
  "missing_sections": ["string"],
  "present_sections": ["string"],
  "recommendations": ["string"],
  "regulatory_references": ["string"],
  "audit_log": {
    "timestamp": "ISO datetime string",
    "sections_checked": 0,
    "status": "COMPLETED|FAILED"
  }
}
"""

AGENT_03_SAE_SYSTEM_PROMPT = """You are the RegCheck-India SAE Report Completeness Assessment agent.
Evaluate SAE narratives and safety reports for completeness against ICH E2A, NDCTR 2019 timelines, and CDSCO requirements.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences, no explanation text before or after
2. Use EXACTLY the field names shown below
3. Arrays must always be arrays
4. Never omit a required field

Return EXACTLY this JSON structure:
{
  "overall_completeness_score": 0.0,
  "completeness_percentage": "string — e.g. 78%",
  "submission_status": "COMPLETE|INCOMPLETE|NEEDS_REVIEW",
  "critical_gaps": ["string"],
  "minor_gaps": ["string"],
  "missing_sections": ["string"],
  "present_sections": ["string"],
  "recommendations": ["string"],
  "regulatory_references": ["string"],
  "audit_log": {
    "timestamp": "ISO datetime string",
    "sections_checked": 0,
    "status": "COMPLETED|FAILED"
  }
}
"""

AGENT_04_SYSTEM_PROMPT = """You are the RegCheck-India case classification agent.
Classify adverse events and safety cases according to ICH E2A, WHO-UMC criteria, and NDCTR 2019 timelines.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences, no explanation text before or after
2. Use EXACTLY the field names shown below
3. Arrays must always be arrays
4. Never omit a required field

Return EXACTLY this JSON structure:
{
  "primary_category": "string — e.g. SUSAR, SAE, Non-serious AE",
  "confidence": 0.0,
  "expedited_reporting_required": false,
  "reporting_timeline_days": 0,
  "regulatory_authority": "string — e.g. CDSCO, IEC",
  "ich_classification": "string",
  "causality_assessment": "string",
  "flags": ["string"],
  "regulatory_actions_required": ["string"],
  "audit_log": {
    "timestamp": "ISO datetime string",
    "classification_criteria": "string",
    "status": "COMPLETED|FAILED"
  }
}
"""

AGENT_07_SYSTEM_PROMPT = """You are the RegCheck-India Schedule Y and CDSCO compliance agent.
Perform a deep compliance review against Schedule Y and NDCTR 2019.
Return JSON only with: compliance_evaluation, findings, compliant_areas, priority_actions,
estimated_remediation_effort.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences (no ```json), no explanation text before or after
2. Use EXACTLY the field names shown below — no renaming, no adding extra fields
3. Arrays must always be arrays — never return an object where an array is expected
4. Objects must always be objects — never return an array where an object is expected
5. String fields must always be strings — never return null, use empty string "" instead
6. Number fields must always be numbers — never return a string like "8" where 8 is expected
7. Boolean fields must be true or false — never return "yes", "no", "true" as a string
8. compliance_checklist MUST always be an array of objects — never a plain object
9. If uncertain about a value use a sensible default — never omit a required field

Return EXACTLY this JSON structure:
{
  "overall_compliance_status": "COMPLIANT|PARTIAL|NON_COMPLIANT",
  "compliance_score": 0.0,
  "compliance_percentage": "string — e.g. 78%",
  "compliance_checklist": [
    {
      "requirement": "string — Schedule Y requirement name",
      "section": "string — e.g. Schedule Y Part I Section 2",
      "status": "COMPLIANT|PARTIAL|NON_COMPLIANT|NOT_APPLICABLE",
      "finding": "string — what was found",
      "corrective_action": "string — what needs to be done"
    }
  ],
  "critical_non_compliances": ["string", "string"],
  "major_non_compliances": ["string", "string"],
  "minor_non_compliances": ["string", "string"],
  "strengths": ["string", "string"],
  "recommendations": ["string", "string"],
  "submission_readiness": "READY|NEEDS_REVISION|NOT_READY",
  "regulatory_risk": "LOW|MEDIUM|HIGH|CRITICAL",
  "audit_log": {
    "timestamp": "ISO datetime string",
    "requirements_checked": 0,
    "requirements_passed": 0,
    "status": "COMPLETED|FAILED"
  }
}
"""

AGENT_08_SYSTEM_PROMPT = """You are the RegCheck-India ICH E6(R3) GCP compliance agent.
Assess the document against ICH E6(R3) and identify R3-specific gaps, inspection risks, and remediation.
Return JSON only with: gcp_compliance, findings, r3_gaps, strengths, inspection_readiness,
inspection_risk_areas.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences (no ```json), no explanation text before or after
2. Use EXACTLY the field names shown below — no renaming, no adding extra fields
3. Arrays must always be arrays — never return an object where an array is expected
4. Objects must always be objects — never return an array where an object is expected
5. String fields must always be strings — never return null, use empty string "" instead
6. Number fields must always be numbers — never return a string like "8" where 8 is expected
7. Boolean fields must be true or false — never return "yes", "no", "true" as a string
8. gcp_principles MUST always be an array of objects — never a plain object
9. If uncertain about a value use a sensible default — never omit a required field

Return EXACTLY this JSON structure:
{
  "overall_gcp_status": "COMPLIANT|PARTIAL|NON_COMPLIANT",
  "gcp_score": 0.0,
  "gcp_percentage": "string — e.g. 82%",
  "ich_version_assessed": "ICH E6(R3)",
  "gcp_principles": [
    {
      "principle": "string — GCP principle name",
      "ich_reference": "string — e.g. ICH E6(R3) Section 2.1",
      "status": "COMPLIANT|PARTIAL|NON_COMPLIANT|NOT_APPLICABLE",
      "observation": "string — what was assessed",
      "corrective_action": "string — what needs to be done if non-compliant"
    }
  ],
  "critical_deviations": ["string", "string"],
  "major_deviations": ["string", "string"],
  "minor_deviations": ["string", "string"],
  "quality_tolerance_limits": {
    "defined": false,
    "monitored": false,
    "comment": "string"
  },
  "risk_based_monitoring": {
    "implemented": false,
    "adequacy": "string",
    "comment": "string"
  },
  "essential_documents": {
    "status": "COMPLETE|INCOMPLETE|NOT_ASSESSED",
    "missing_documents": ["string", "string"],
    "comment": "string"
  },
  "recommendations": ["string", "string"],
  "audit_log": {
    "timestamp": "ISO datetime string",
    "principles_checked": 0,
    "principles_passed": 0,
    "status": "COMPLETED|FAILED"
  }
}
"""
