"""
RegCheck-India AI Agents Router.

Provides a Claude-backed `/api/v1/agents/*` surface for the core agent workflows.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.services.claude_client import MODEL_HAIKU, MODEL_SONNET

logger = logging.getLogger(__name__)

router = APIRouter()


class AgentRequest(BaseModel):
    document: str = Field(..., description="Raw text of the regulatory document to process")
    metadata: Optional[dict] = Field(default_factory=dict, description="Optional document metadata")


class QARequest(BaseModel):
    question: str = Field(..., description="Regulatory question from the user")
    retrieved_context: str = Field(..., description="Retrieved ChromaDB context")
    metadata: Optional[dict] = Field(default_factory=dict, description="Optional query metadata")


class AgentResponse(BaseModel):
    agent: str
    model: str
    result: Any
    timestamp: str
    token_usage: dict


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_json_block(raw_text: str) -> Any:
    text = raw_text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500, 
            detail=f"Model did not return valid JSON: {exc}"
        )


def call_claude(
    agent_name: str,
    model: str,
    system_prompt: str,
    user_content: str,
    api_key: str,
    max_tokens: int = 4096,
) -> AgentResponse:
    """Shared Anthropic caller for the v1 agents router.

    Uses the caller-supplied ``api_key`` so that each public user's own
    Anthropic credits are consumed rather than the server key.
    """
    admin_password = "admin-regcheck"
    if api_key == admin_password:
        import os
        server_key = os.getenv("ANTHROPIC_API_KEY")
        if not server_key:
            raise HTTPException(status_code=500, detail="Server Anthropic API key missing.")
        client = anthropic.Anthropic(api_key=server_key)
    else:
        if not api_key:
            raise HTTPException(
                status_code=401,
                detail="No Anthropic API key provided. Add your key via the ⚙ Settings panel in the app.",
            )
        client = anthropic.Anthropic(api_key=api_key)
    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        )
        raw_text = response.content[0].text.strip()
        parsed = _parse_json_block(raw_text)
        return AgentResponse(
            agent=agent_name,
            model=model,
            result=parsed,
            timestamp=_utc_timestamp(),
            token_usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )
    except anthropic.AuthenticationError:
        logger.error("Anthropic auth failed for %s", agent_name)
        raise HTTPException(status_code=401, detail="Anthropic API key is invalid. Please check and update your key in Settings.")
    except anthropic.RateLimitError:
        logger.warning("Anthropic rate limit hit for %s", agent_name)
        raise HTTPException(status_code=429, detail="Rate limit reached - retry after a moment")
    except anthropic.APIError as exc:
        logger.error("Anthropic API error in %s: %s", agent_name, exc)
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {exc}")
    except Exception as exc:
        logger.error("Unexpected error in %s: %s", agent_name, exc)
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}")


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

AGENT_02_SYSTEM_PROMPT = """You are the RegCheck-India document summarisation agent.
Summarise regulatory documents into structured reviewer-friendly JSON.
Preserve key findings, deadlines, safety highlights, and data integrity flags.
Return JSON only with: document_type, document_reference, summary, word_count_original, compression_ratio.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences (no ```json), no explanation text before or after
2. Use EXACTLY the field names shown below — no renaming, no adding extra fields
3. Arrays must always be arrays — never return an object where an array is expected
4. Objects must always be objects — never return an array where an object is expected  
5. String fields must always be strings — never return null, use empty string "" instead
6. Number fields must always be numbers — never return a string like "8" where 8 is expected
7. If uncertain about a value use a sensible default — never omit a required field

Return EXACTLY this JSON structure:
{
  "summary": "string — 2-4 sentence executive summary of the document",
  "document_type": "string — e.g. Clinical Trial Protocol, SAE Report, IB, etc.",
  "key_sections": ["string", "string"],
  "regulatory_references": ["string", "string"],
  "compliance_gaps": ["string", "string"],
  "recommendations": ["string", "string"],
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "word_count_original": 0,
  "readability_score": "string — e.g. Technical/Complex",
  "audit_log": {
    "timestamp": "ISO datetime string",
    "document_pages": 0,
    "processing_time": "string",
    "status": "COMPLETED|FAILED"
  }
}
"""

AGENT_03_SYSTEM_PROMPT = """You are the RegCheck-India completeness assessment agent.
Evaluate whether a pharmaceutical submission is complete against CDSCO, Schedule Y, NDCTR 2019, and ICH requirements.
Return JSON only with: document_type, overall_status, completeness_score, sections_present, sections_missing,
data_gaps, submission_readiness, conditions.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences (no ```json), no explanation text before or after
2. Use EXACTLY the field names shown below — no renaming, no adding extra fields
3. Arrays must always be arrays — never return an object where an array is expected
4. Objects must always be objects — never return an array where an object is expected
5. String fields must always be strings — never return null, use empty string "" instead
6. Number fields must always be numbers — never return a string like "8" where 8 is expected
7. Boolean fields must be true or false — never return "yes", "no", "true" as a string
8. If uncertain about a value use a sensible default — never omit a required field

Return EXACTLY this JSON structure:
{
  "overall_completeness_score": 0.0,
  "completeness_percentage": "string — e.g. 85%",
  "missing_sections": ["string", "string"],
  "present_sections": ["string", "string"],
  "incomplete_sections": ["string", "string"],
  "critical_gaps": ["string", "string"],
  "minor_gaps": ["string", "string"],
  "regulatory_requirements_met": {
    "schedule_y": true,
    "ich_e6": true,
    "cdsco": true,
    "icmr": true
  },
  "recommendations": ["string", "string"],
  "submission_readiness": "READY|NEEDS_REVISION|NOT_READY",
  "priority_actions": ["string", "string"],
  "audit_log": {
    "timestamp": "ISO datetime string",
    "sections_checked": 0,
    "sections_passed": 0,
    "status": "COMPLETED|FAILED"
  }
}
"""

AGENT_04_SYSTEM_PROMPT = """You are the RegCheck-India case classification agent.
Classify serious adverse event narratives using ICH E2A seriousness, WHO-UMC causality,
and Indian pharmacovigilance timelines. Return JSON only with:
primary_category, secondary_categories, confidence, reporting_timeline, priority_score,
classification_rationale, causality, product_relatedness, requires_expedited_reporting,
flags, seriousness_criteria.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences (no ```json), no explanation text before or after
2. Use EXACTLY the field names shown below — no renaming, no adding extra fields
3. Arrays must always be arrays — never return an object where an array is expected
4. Objects must always be objects — never return an array where an object is expected
5. String fields must always be strings — never return null, use empty string "" instead
6. Number fields must always be numbers — never return a string like "8" where 8 is expected
7. Boolean fields must be true or false — never return "yes", "no", "true" as a string
8. seriousness_criteria MUST always be an object with boolean values — never an array
9. If uncertain about a value use a sensible default — never omit a required field

Return EXACTLY this JSON structure:
{
  "primary_category": "string",
  "secondary_categories": ["string", "string"],
  "confidence": 0.0,
  "priority_score": 0.0,
  "requires_expedited_reporting": true,
  "classification_rationale": "string",
  "seriousness_criteria": {
    "life_threatening": false,
    "hospitalization": false,
    "icu_admission": false,
    "requires_intervention_for_life": false,
    "unexpected_severity": false
  },
  "causality": {
    "assessment": "string — PROBABLE|POSSIBLE|UNLIKELY|UNRELATED",
    "who_umc_category": "string",
    "rationale": "string",
    "temporal_relationship": "string",
    "dose_response": "string",
    "dechallenge": "string",
    "alternative_causes": "string"
  },
  "reporting_timeline": {
    "event_date": "string",
    "sponsor_notification": "string",
    "timeline_status": "COMPLIANT|NON_COMPLIANT|PENDING",
    "regulatory_deadline_india": "string",
    "days_to_deadline": 0,
    "urgency_note": "string"
  },
  "product_relatedness": {
    "related_to_study_drug": false,
    "relationship_strength": "string",
    "safety_signal": "string",
    "signal_severity": "LOW|MEDIUM|HIGH|CRITICAL"
  },
  "flags": ["string", "string"],
  "regulatory_actions_required": ["string", "string"],
  "case_quality_assessment": {
    "documentation_completeness": "string",
    "causality_evidence": "string",
    "temporal_data": "string",
    "follow_up_status": "string",
    "data_integrity": "string"
  },
  "audit_log": {
    "timestamp": "ISO datetime string",
    "status": "COMPLETED|FAILED"
  }
}
"""

AGENT_05_SYSTEM_PROMPT = """You are the RegCheck-India inspection report generation agent.
Turn inspection findings into a structured CDSCO-style report with observations, CAPA, and compliance rating.
Return JSON only with: report_type, document_control, executive_summary, observations, capa_plan,
overall_compliance_rating, re_inspection_required.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences (no ```json), no explanation text before or after
2. Use EXACTLY the field names shown below — no renaming, no adding extra fields
3. Arrays must always be arrays — never return an object where an array is expected
4. Objects must always be objects — never return an array where an object is expected
5. String fields must always be strings — never return null, use empty string "" instead
6. Number fields must always be numbers — never return a string like "8" where 8 is expected
7. Boolean fields must be true or false — never return "yes", "no", "true" as a string
8. If uncertain about a value use a sensible default — never omit a required field

Return EXACTLY this JSON structure:
{
  "report_title": "string",
  "inspection_date": "string",
  "site_name": "string",
  "overall_rating": "SATISFACTORY|NEEDS_IMPROVEMENT|UNSATISFACTORY|CRITICAL",
  "executive_summary": "string",
  "findings": [
    {
      "finding_id": "string",
      "category": "string",
      "severity": "CRITICAL|MAJOR|MINOR|OBSERVATION",
      "description": "string",
      "regulatory_reference": "string",
      "corrective_action": "string",
      "deadline": "string"
    }
  ],
  "critical_findings_count": 0,
  "major_findings_count": 0,
  "minor_findings_count": 0,
  "observations_count": 0,
  "regulatory_references": ["string", "string"],
  "compliance_areas": {
    "informed_consent": "COMPLIANT|PARTIAL|NON_COMPLIANT",
    "data_integrity": "COMPLIANT|PARTIAL|NON_COMPLIANT",
    "protocol_adherence": "COMPLIANT|PARTIAL|NON_COMPLIANT",
    "safety_reporting": "COMPLIANT|PARTIAL|NON_COMPLIANT",
    "record_keeping": "COMPLIANT|PARTIAL|NON_COMPLIANT"
  },
  "recommendations": ["string", "string"],
  "follow_up_required": true,
  "follow_up_date": "string",
  "audit_log": {
    "timestamp": "ISO datetime string",
    "inspector": "string",
    "status": "COMPLETED|FAILED"
  }
}
"""

AGENT_06_SYSTEM_PROMPT = """You are the RegCheck-India regulatory Q&A agent.
Answer only from the retrieved context provided. Cite specific regulatory basis, state when context is insufficient,
and return JSON only with: answer, regulatory_citations, confidence, confidence_reason,
follow_up_suggested, disclaimer.

CRITICAL OUTPUT RULES — YOU MUST FOLLOW THESE EXACTLY:
1. Return ONLY valid JSON — no markdown, no code fences (no ```json), no explanation text before or after
2. Use EXACTLY the field names shown below — no renaming, no adding extra fields
3. Arrays must always be arrays — never return an object where an array is expected
4. Objects must always be objects — never return an array where an object is expected
5. String fields must always be strings — never return null, use empty string "" instead
6. Number fields must always be numbers — never return a string like "8" where 8 is expected
7. Boolean fields must be true or false — never return "yes", "no", "true" as a string
8. If uncertain about a value use a sensible default — never omit a required field

Return EXACTLY this JSON structure:
{
  "answer": "string — comprehensive answer to the regulatory question",
  "confidence_score": 0.0,
  "regulatory_basis": ["string", "string"],
  "applicable_guidelines": [
    {
      "guideline": "string — e.g. Schedule Y, ICH E6(R3)",
      "section": "string — specific section reference",
      "relevance": "string — how it applies to the question"
    }
  ],
  "key_requirements": ["string", "string"],
  "exceptions_or_conditions": ["string", "string"],
  "related_topics": ["string", "string"],
  "references": [
    {
      "title": "string",
      "document": "string",
      "section": "string"
    }
  ],
  "disclaimer": "string",
  "audit_log": {
    "timestamp": "ISO datetime string",
    "query_type": "string",
    "sources_consulted": 0,
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


@router.get("/anonymise/health", summary="Agent 01 - Anonymise Health Check")
async def anonymise_health():
    """Lightweight CORS smoke-test endpoint — no API key required, no LLM call."""
    return {"status": "ok", "agent": "PII_PHI_Anonymisation", "endpoint": "/api/v1/agents/anonymise"}


@router.post("/anonymise", response_model=AgentResponse, summary="Agent 01 - PII/PHI Anonymisation")
async def anonymise_document(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="PII_PHI_Anonymisation",
        model=MODEL_HAIKU,
        system_prompt=AGENT_01_SYSTEM_PROMPT,
        user_content=f"Document metadata: {json.dumps(request.metadata)}\n\nDocument:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=4096,
    )


@router.post("/summarise", response_model=AgentResponse, summary="Agent 02 - Document Summarisation")
async def summarise_document(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="Document_Summarisation",
        model=MODEL_HAIKU,
        system_prompt=AGENT_02_SYSTEM_PROMPT,
        user_content=f"Document metadata: {json.dumps(request.metadata)}\n\nDocument:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=4096,
    )


@router.post("/completeness", response_model=AgentResponse, summary="Agent 03 - Completeness Assessment")
async def assess_completeness(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="Completeness_Assessment",
        model=MODEL_SONNET,
        system_prompt=AGENT_03_SYSTEM_PROMPT,
        user_content=f"Document metadata: {json.dumps(request.metadata)}\n\nDocument:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=4096,
    )


@router.post("/classify", response_model=AgentResponse, summary="Agent 04 - Case Classification")
async def classify_case(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="Case_Classification",
        model=MODEL_HAIKU,
        system_prompt=AGENT_04_SYSTEM_PROMPT,
        user_content=f"Case metadata: {json.dumps(request.metadata)}\n\nCase narrative:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=4096,
    )


@router.post("/inspection-report", response_model=AgentResponse, summary="Agent 05 - Inspection Report Generation")
async def generate_inspection_report(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="Inspection_Report_Generation",
        model=MODEL_SONNET,
        system_prompt=AGENT_05_SYSTEM_PROMPT,
        user_content=f"Inspection metadata: {json.dumps(request.metadata)}\n\nInspection findings:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=4096,
    )


@router.post("/qa", response_model=AgentResponse, summary="Agent 06 - Regulatory Q&A")
async def regulatory_qa(request: QARequest, x_anthropic_api_key: Optional[str] = Header(None)):
    retrieved_context = request.retrieved_context
    if not retrieved_context or len(retrieved_context.strip()) < 50:
        try:
            import os
            import chromadb
            from chromadb.utils import embedding_functions

            chromadb_path = os.getenv("CHROMADB_PATH", "./data/chromadb")
            try:
                from chromadb.config import Settings

                client = chromadb.Client(
                    Settings(
                        chroma_db_impl="duckdb+parquet",
                        persist_directory=chromadb_path,
                        anonymized_telemetry=False,
                    )
                )
            except ImportError:
                client = chromadb.PersistentClient(
                    path=chromadb_path,
                    settings=chromadb.Settings(anonymized_telemetry=False),
                )
            embedding_fn = embedding_functions.DefaultEmbeddingFunction()
            
            collection = client.get_collection(name="regulatory_documents", embedding_function=embedding_fn)
            results = collection.query(
                query_texts=[request.question],
                n_results=5
            )
            
            if results and results["documents"] and results["documents"][0]:
                retrieved_context = "\n\n".join(results["documents"][0])
        except Exception as e:
            logger.warning(f"ChromaDB retrieval failed: {e}")

    if not retrieved_context or len(retrieved_context.strip()) < 50:
        context_section = """[CONTEXT]
Note: No documents were found in the knowledge base for this query. 
Answer using your comprehensive built-in knowledge of Indian pharmaceutical regulations including:
- New Drugs and Clinical Trials Rules (NDCTR) 2019
- Schedule Y of Drugs and Cosmetics Act
- CDSCO guidelines and circulars
- ICH guidelines (E6, E2A, E3, E8, E9)
- ICMR Guidelines for Biomedical and Health Research
- Drugs and Cosmetics Act 1940
Clearly state at the end that this answer is based on general regulatory knowledge and not retrieved documents.
[/CONTEXT]"""
    else:
        context_section = f"[CONTEXT]\n{retrieved_context}\n[/CONTEXT]"

    user_content = (
        f"{context_section}\n\n"
        f"QUESTION: {request.question}\n\nAdditional metadata: {json.dumps(request.metadata)}"
    )
    return call_claude(
        agent_name="Regulatory_QA_RAG",
        model=MODEL_HAIKU,
        system_prompt=AGENT_06_SYSTEM_PROMPT,
        user_content=user_content,
        api_key=x_anthropic_api_key or "",
        max_tokens=4096,
    )


@router.post("/schedule-y", response_model=AgentResponse, summary="Agent 07 - Schedule Y / CDSCO Compliance")
async def check_schedule_y(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="Schedule_Y_Compliance",
        model=MODEL_SONNET,
        system_prompt=AGENT_07_SYSTEM_PROMPT,
        user_content=f"Document metadata: {json.dumps(request.metadata)}\n\nDocument:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=4096,
    )


@router.post("/ich-gcp", response_model=AgentResponse, summary="Agent 08 - ICH E6(R3) GCP Compliance")
async def check_ich_gcp(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="ICH_GCP_Compliance",
        model=MODEL_SONNET,
        system_prompt=AGENT_08_SYSTEM_PROMPT,
        user_content=f"Document metadata: {json.dumps(request.metadata)}\n\nDocument:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=4096,
    )


@router.get("/health", summary="Agents Health Check")
async def agents_health():
    return {
        "status": "ok",
        "agents": [
            {"id": "01", "name": "PII_PHI_Anonymisation", "endpoint": "/anonymise", "model": MODEL_HAIKU},
            {"id": "02", "name": "Document_Summarisation", "endpoint": "/summarise", "model": MODEL_HAIKU},
            {"id": "03", "name": "Completeness_Assessment", "endpoint": "/completeness", "model": MODEL_SONNET},
            {"id": "04", "name": "Case_Classification", "endpoint": "/classify", "model": MODEL_HAIKU},
            {"id": "05", "name": "Inspection_Report_Generation", "endpoint": "/inspection-report", "model": MODEL_SONNET},
            {"id": "06", "name": "Regulatory_QA_RAG", "endpoint": "/qa", "model": MODEL_HAIKU},
            {"id": "07", "name": "Schedule_Y_Compliance", "endpoint": "/schedule-y", "model": MODEL_SONNET},
            {"id": "08", "name": "ICH_GCP_Compliance", "endpoint": "/ich-gcp", "model": MODEL_SONNET},
        ],
        "anthropic_client": "initialised",
        "timestamp": _utc_timestamp(),
    }
