"""Comparison endpoints (M6)."""

from fastapi import APIRouter, Header, HTTPException

from app.models.hackathon_schemas import CompletenessRequest, VersionCompareRequest
from app.services.document_comparator import DocumentVersionComparator
from app.services.evaluator import sugam_checklist_evaluator
from app.services.runtime_state_store import runtime_state_store

router = APIRouter()
comparator = DocumentVersionComparator()
_DIFF_STORE = {}
_REPORT_STORE = {}


def _ensure_session_access(session_id: str, x_session_id: str):
    if session_id != x_session_id:
        raise HTTPException(status_code=403, detail="Session access denied")


def _with_attr(payload: dict, primary_model: str = "claude-sonnet-4-20250514") -> dict:
    payload["model_attribution"] = {
        "primary_model": primary_model,
        "provider": "Anthropic Claude",
        "sovereign": False,
    }
    return payload


@router.post("/versions")
async def compare_versions(request: VersionCompareRequest, x_session_id: str = Header(default="default_session")):
    result = await comparator.compare_versions(request.doc_v1_text, request.doc_v2_text, request.doc_type)
    _DIFF_STORE[x_session_id] = result.get("diff_html", "")
    _REPORT_STORE[x_session_id] = result
    runtime_state_store.put("comparison", x_session_id, "diff_html", result.get("diff_html", ""))
    runtime_state_store.put("comparison", x_session_id, "report", result)
    return _with_attr(result, "claude-sonnet-4-20250514")


@router.post("/completeness")
async def compare_completeness(request: CompletenessRequest, x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    return _with_attr(sugam_checklist_evaluator.evaluate_ct04_completeness(request.data), "claude-haiku-4-20250414")


@router.post("/sae-completeness")
async def compare_sae_completeness(request: CompletenessRequest, x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    return _with_attr(sugam_checklist_evaluator.evaluate_sae_completeness(request.data), "claude-haiku-4-20250414")


@router.get("/diff/{session_id}")
async def get_diff(session_id: str, x_session_id: str = Header(default="default_session")):
    _ensure_session_access(session_id, x_session_id)
    diff_html = runtime_state_store.get("comparison", session_id, "diff_html", default=None)
    if diff_html is None:
        diff_html = _DIFF_STORE.get(session_id, "")
    return _with_attr({"session_id": session_id, "diff_html": diff_html}, "claude-sonnet-4-20250514")


@router.get("/report/{session_id}")
async def get_report(session_id: str, x_session_id: str = Header(default="default_session")):
    _ensure_session_access(session_id, x_session_id)
    report = runtime_state_store.get("comparison", session_id, "report", default=None)
    if report is None:
        report = _REPORT_STORE.get(session_id, {"detail": "No report found"})
    return _with_attr(report, "claude-sonnet-4-20250514")
