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
    max_tokens: int = 2048,
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
Return JSON only with: document_type, document_reference, summary, word_count_original, compression_ratio."""

AGENT_03_SYSTEM_PROMPT = """You are the RegCheck-India completeness assessment agent.
Evaluate whether a pharmaceutical submission is complete against CDSCO, Schedule Y, NDCTR 2019, and ICH requirements.
Return JSON only with: document_type, overall_status, completeness_score, sections_present, sections_missing,
data_gaps, submission_readiness, conditions."""

AGENT_04_SYSTEM_PROMPT = """You are the RegCheck-India case classification agent.
Classify serious adverse event narratives using ICH E2A seriousness, WHO-UMC causality,
and Indian pharmacovigilance timelines. Return JSON only with:
primary_category, secondary_categories, confidence, reporting_timeline, priority_score,
classification_rationale, causality, product_relatedness, requires_expedited_reporting,
flags, seriousness_criteria."""

AGENT_05_SYSTEM_PROMPT = """You are the RegCheck-India inspection report generation agent.
Turn inspection findings into a structured CDSCO-style report with observations, CAPA, and compliance rating.
Return JSON only with: report_type, document_control, executive_summary, observations, capa_plan,
overall_compliance_rating, re_inspection_required."""

AGENT_06_SYSTEM_PROMPT = """You are the RegCheck-India regulatory Q&A agent.
Answer only from the retrieved context provided. Cite specific regulatory basis, state when context is insufficient,
and return JSON only with: answer, regulatory_citations, confidence, confidence_reason,
follow_up_suggested, disclaimer."""

AGENT_07_SYSTEM_PROMPT = """You are the RegCheck-India Schedule Y and CDSCO compliance agent.
Perform a deep compliance review against Schedule Y and NDCTR 2019.
Return JSON only with: compliance_evaluation, findings, compliant_areas, priority_actions,
estimated_remediation_effort."""

AGENT_08_SYSTEM_PROMPT = """You are the RegCheck-India ICH E6(R3) GCP compliance agent.
Assess the document against ICH E6(R3) and identify R3-specific gaps, inspection risks, and remediation.
Return JSON only with: gcp_compliance, findings, r3_gaps, strengths, inspection_readiness,
inspection_risk_areas."""


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
        max_tokens=2048,
    )


@router.post("/completeness", response_model=AgentResponse, summary="Agent 03 - Completeness Assessment")
async def assess_completeness(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="Completeness_Assessment",
        model=MODEL_SONNET,
        system_prompt=AGENT_03_SYSTEM_PROMPT,
        user_content=f"Document metadata: {json.dumps(request.metadata)}\n\nDocument:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=3000,
    )


@router.post("/classify", response_model=AgentResponse, summary="Agent 04 - Case Classification")
async def classify_case(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="Case_Classification",
        model=MODEL_HAIKU,
        system_prompt=AGENT_04_SYSTEM_PROMPT,
        user_content=f"Case metadata: {json.dumps(request.metadata)}\n\nCase narrative:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=1500,
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
    user_content = (
        f"[CONTEXT]\n{request.retrieved_context}\n[/CONTEXT]\n\n"
        f"QUESTION: {request.question}\n\nAdditional metadata: {json.dumps(request.metadata)}"
    )
    return call_claude(
        agent_name="Regulatory_QA_RAG",
        model=MODEL_HAIKU,
        system_prompt=AGENT_06_SYSTEM_PROMPT,
        user_content=user_content,
        api_key=x_anthropic_api_key or "",
        max_tokens=2048,
    )


@router.post("/schedule-y", response_model=AgentResponse, summary="Agent 07 - Schedule Y / CDSCO Compliance")
async def check_schedule_y(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="Schedule_Y_Compliance",
        model=MODEL_SONNET,
        system_prompt=AGENT_07_SYSTEM_PROMPT,
        user_content=f"Document metadata: {json.dumps(request.metadata)}\n\nDocument:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=3500,
    )


@router.post("/ich-gcp", response_model=AgentResponse, summary="Agent 08 - ICH E6(R3) GCP Compliance")
async def check_ich_gcp(request: AgentRequest, x_anthropic_api_key: Optional[str] = Header(None)):
    return call_claude(
        agent_name="ICH_GCP_Compliance",
        model=MODEL_SONNET,
        system_prompt=AGENT_08_SYSTEM_PROMPT,
        user_content=f"Document metadata: {json.dumps(request.metadata)}\n\nDocument:\n{request.document}",
        api_key=x_anthropic_api_key or "",
        max_tokens=3500,
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
