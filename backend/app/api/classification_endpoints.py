"""SAE classification endpoints (M7)."""

from fastapi import APIRouter, Header

from app.models.hackathon_schemas import (
    PriorityQueueRequest,
    SAEBatchClassifyRequest,
    SAEClassifyRequest,
    SAEDuplicateRequest,
)
from app.services.runtime_state_store import runtime_state_store
from app.services.sae_classifier import duplicate_engine, prioritisation_engine, sae_classifier

router = APIRouter()
_QUEUE = []


def _get_queue(session_id: str) -> list[dict]:
    queue = runtime_state_store.get("classification", session_id, "queue", default=None)
    if isinstance(queue, list):
        return queue
    if session_id == "default_session":
        return list(_QUEUE)
    return []


def _with_attr(payload: dict, primary_model: str = "rule-engine") -> dict:
    if "model_attribution" in payload:
        return payload
    payload["model_attribution"] = {
        "primary_model": primary_model,
        "provider": "Anthropic Claude" if primary_model != "rule-engine" else "RegCheck prioritisation engine",
        "sovereign": False,
    }
    return payload


@router.post("/sae")
async def classify_sae(request: SAEClassifyRequest, x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    return _with_attr(await sae_classifier.classify(request.sae_text))


@router.post("/sae-batch")
async def classify_sae_batch(request: SAEBatchClassifyRequest, x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    return _with_attr({"results": [await sae_classifier.classify(t) for t in request.sae_texts]}, "claude-haiku-4-20250414")


@router.post("/duplicate-check")
async def duplicate_check(request: SAEDuplicateRequest, x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    return _with_attr(await duplicate_engine.check_duplicate(request.sae_case), "chroma+rule-engine")


@router.post("/prioritise")
async def prioritise(request: PriorityQueueRequest, x_session_id: str = Header(default="default_session")):
    global _QUEUE
    queue = []
    for case in request.cases:
        case = dict(case)
        case["priority_score"] = prioritisation_engine.calculate_priority_score(case)
        queue.append(case)
    _QUEUE = sorted(queue, key=lambda c: c.get("priority_score", 0), reverse=True)
    runtime_state_store.put("classification", x_session_id, "queue", _QUEUE)
    return _with_attr({"queue": _QUEUE}, "rule-engine")


@router.get("/queue")
async def get_queue(x_session_id: str = Header(default="default_session")):
    return _with_attr({"queue": _get_queue(x_session_id)}, "rule-engine")


@router.get("/stats")
async def get_stats(x_session_id: str = Header(default="default_session")):
    queue = _get_queue(x_session_id)
    total = len(queue)
    top = queue[0] if queue else None
    return _with_attr({"total_cases": total, "top_priority_case": top}, "rule-engine")
