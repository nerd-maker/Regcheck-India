"""
Critical Gap API Endpoints

REST API endpoints for all 16 critical gap solutions:
- Gap 2: Multi-signal confidence
- Gap 6: Revision loop management
- Gap 7: Tenant isolation reports
- Gap 8: Prompt versioning
- Gap 9: Output determinism
- Gap 10: Translation validation (REMOVED - English only)
- Gap 11: Classification confidence
- Gap 12: Deadline-aware review queue
- Gap 13: KB version locking (already in kb_version_manager.py)
- Gap 14: Ground truth evaluation
- Gap 15: Cross-reference validation
- Gap 16: Commitment tracking
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

# Import all gap services
from app.services.confidence_assessor import confidence_assessor
from app.services.revision_loop_manager import revision_loop_manager, RevisionIssue
from app.services.tenant_isolation import tenant_isolation, TenantContext
from app.services.prompt_version_manager import prompt_version_manager
from app.services.output_determinism import output_determinism
# Translation validator removed (English-only product)
from app.services.classification_confidence import classification_confidence_manager
from app.services.deadline_review_queue import deadline_review_queue
from app.services.ground_truth_evaluator import ground_truth_evaluator
from app.services.section_context_store import cross_reference_validator
from app.services.commitment_tracker import commitment_manager

router = APIRouter(prefix="/api/v1/gaps", tags=["Critical Gap Solutions"])


# ──────────────────────────────────────────────────────
# Gap 2: Multi-Signal Confidence
# ──────────────────────────────────────────────────────

class ConfidenceRequest(BaseModel):
    retrieval_scores: List[float]
    citations_found: int
    citations_expected: int
    schema_valid: bool
    schema_fields_present: int
    schema_fields_total: int
    llm_confidence: float


@router.post("/confidence/assess")
async def assess_confidence(req: ConfidenceRequest):
    """Assess multi-signal confidence for an output."""
    result = confidence_assessor.assess(
        retrieval_scores=req.retrieval_scores,
        citations_found=req.citations_found,
        citations_expected=req.citations_expected,
        schema_valid=req.schema_valid,
        schema_fields_present=req.schema_fields_present,
        schema_fields_total=req.schema_fields_total,
        llm_confidence=req.llm_confidence,
    )
    return result.model_dump()


# ──────────────────────────────────────────────────────
# Gap 6: Revision Loop
# ──────────────────────────────────────────────────────

class RevisionCheckRequest(BaseModel):
    section_name: str
    issues: Optional[List[Dict]] = None


@router.post("/revision/check")
async def check_revision(req: RevisionCheckRequest):
    """Check if a section should be revised or escalated."""
    if req.issues:
        parsed_issues = [RevisionIssue(**i) for i in req.issues]
        revision_loop_manager.init_section(req.section_name, parsed_issues)
    return revision_loop_manager.should_revise(req.section_name)


@router.get("/revision/escalations")
async def get_escalations():
    """Get summary of all escalated sections."""
    return revision_loop_manager.get_escalation_summary()


# ──────────────────────────────────────────────────────
# Gap 7: Tenant Isolation
# ──────────────────────────────────────────────────────

@router.get("/tenant/isolation-report")
async def get_isolation_report(tenant_id: Optional[str] = None):
    """Get tenant isolation audit report."""
    return tenant_isolation.get_isolation_report(tenant_id)


# ──────────────────────────────────────────────────────
# Gap 8: Prompt Versioning
# ──────────────────────────────────────────────────────

class PromptRegisterRequest(BaseModel):
    prompt_name: str
    semantic_version: str
    system_prompt: str
    changelog: Dict


@router.post("/prompts/register")
async def register_prompt(req: PromptRegisterRequest):
    """Register a new prompt version."""
    version = prompt_version_manager.register_prompt(
        prompt_name=req.prompt_name,
        semantic_version=req.semantic_version,
        system_prompt=req.system_prompt,
        changelog=req.changelog,
    )
    return {"version_id": version.version_id, "full_name": version.full_name}


@router.get("/prompts/{prompt_name}/history")
async def get_prompt_history(prompt_name: str):
    """Get version history for a prompt."""
    return prompt_version_manager.get_version_history(prompt_name)


@router.post("/prompts/{prompt_name}/freeze/{submission_id}")
async def freeze_prompt(prompt_name: str, submission_id: str):
    """Freeze prompt version for an active submission."""
    success = prompt_version_manager.freeze_for_submission(prompt_name, submission_id)
    if not success:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return {"frozen": True, "prompt_name": prompt_name, "submission_id": submission_id}


# ──────────────────────────────────────────────────────
# Gap 9: Output Determinism
# ──────────────────────────────────────────────────────

@router.get("/cache/stats")
async def get_cache_stats():
    """Get output cache statistics."""
    return output_determinism.get_cache_stats()


class HumanReviewRequest(BaseModel):
    input_hash: str
    kb_version: str
    reviewer: str
    reviewed_output: Optional[Dict] = None


@router.post("/cache/mark-reviewed")
async def mark_reviewed(req: HumanReviewRequest):
    """Mark cached output as human-reviewed (definitive truth)."""
    success = output_determinism.mark_human_reviewed(
        input_hash=req.input_hash,
        kb_version=req.kb_version,
        reviewer=req.reviewer,
        reviewed_output=req.reviewed_output,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Cached output not found")
    return {"marked_definitive": True}


# Gap 10: Translation Validation — REMOVED (English-only product)


# ──────────────────────────────────────────────────────
# Gap 11: Classification Confidence
# ──────────────────────────────────────────────────────

class ClassifyRequest(BaseModel):
    candidates: List[Dict]
    session_id: str


@router.post("/classification/assess")
async def assess_classification(req: ClassifyRequest):
    """Assess classification confidence and routing."""
    result = classification_confidence_manager.assess_classification(
        candidates=req.candidates,
        session_id=req.session_id,
    )
    return result.model_dump()


@router.post("/classification/confirm/{confirmation_id}")
async def confirm_classification(
    confirmation_id: str,
    selected_category: str,
    user_id: str
):
    """Confirm/override a classification."""
    try:
        req = classification_confidence_manager.record_confirmation(
            confirmation_id=confirmation_id,
            selected_category=selected_category,
            user_id=user_id,
        )
        return {"confirmed": True, "selected": selected_category}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/classification/misclassification-patterns")
async def get_misclassification_patterns():
    """Get categories with high edit rates (misclassification signals)."""
    return classification_confidence_manager.get_misclassification_patterns()


# ──────────────────────────────────────────────────────
# Gap 12: Deadline Review Queue
# ──────────────────────────────────────────────────────

@router.get("/review-queue/dashboard")
async def get_review_dashboard(customer_id: Optional[str] = None):
    """Get deadline-aware review queue dashboard (home screen widget)."""
    return deadline_review_queue.get_dashboard_data(customer_id)


@router.post("/review-queue/check-alerts")
async def check_review_alerts():
    """Run alert check across all review queue items."""
    alerts = deadline_review_queue.check_and_generate_alerts()
    return {"alerts_generated": len(alerts), "alerts": alerts}


@router.post("/review-queue/{queue_id}/approve")
async def approve_review(queue_id: str, reviewer_id: str):
    """Approve a review queue item."""
    if not deadline_review_queue.approve_item(queue_id, reviewer_id):
        raise HTTPException(status_code=404, detail="Queue item not found")
    return {"approved": True}


@router.post("/review-queue/{queue_id}/override")
async def override_escalated(queue_id: str, override_by: str, reason: str):
    """Override an escalated/locked review item."""
    if not deadline_review_queue.override_escalated(queue_id, override_by, reason):
        raise HTTPException(status_code=400, detail="Item not found or not escalated")
    return {"overridden": True}


# ──────────────────────────────────────────────────────
# Gap 14: Ground Truth Evaluation
# ──────────────────────────────────────────────────────

class EvaluationRequest(BaseModel):
    predictions: List[Dict]
    kb_version: str = ""
    prompt_version: str = ""


@router.post("/ground-truth/evaluate")
async def run_evaluation(req: EvaluationRequest):
    """Run M1 predictions against ground truth."""
    report = ground_truth_evaluator.evaluate_predictions(
        predictions=req.predictions,
        kb_version=req.kb_version,
        prompt_version=req.prompt_version,
    )
    return report.model_dump()


@router.get("/ground-truth/trend")
async def get_accuracy_trend():
    """Get accuracy trends across evaluations."""
    return ground_truth_evaluator.get_trend_report()


@router.get("/ground-truth/degradation-check")
async def check_degradation():
    """Check for accuracy degradation vs previous evaluation."""
    result = ground_truth_evaluator.check_degradation()
    if result is None:
        return {"message": "Not enough evaluations to compare"}
    return result


# ──────────────────────────────────────────────────────
# Gap 16: Commitment Tracking
# ──────────────────────────────────────────────────────

@router.get("/commitments/dashboard")
async def get_commitments_dashboard(
    customer_id: Optional[str] = None,
    submission_id: Optional[str] = None
):
    """Get commitments dashboard (all active commitments across submissions)."""
    data = commitment_manager.get_dashboard(
        customer_id=customer_id,
        submission_id=submission_id,
    )
    return data.model_dump()


class CommitmentCompleteRequest(BaseModel):
    commitment_id: str
    completed_by: str
    evidence_type: str  # document, email, note
    evidence_content: str
    evidence_file_url: Optional[str] = None


@router.post("/commitments/complete")
async def complete_commitment(req: CommitmentCompleteRequest):
    """Mark commitment complete with mandatory evidence."""
    if not req.evidence_content.strip():
        raise HTTPException(status_code=400, detail="Evidence is mandatory")

    success = commitment_manager.mark_complete(
        commitment_id=req.commitment_id,
        completed_by=req.completed_by,
        evidence_type=req.evidence_type,
        evidence_content=req.evidence_content,
        evidence_file_url=req.evidence_file_url,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Commitment not found")
    return {"completed": True}


@router.post("/commitments/check-alerts")
async def check_commitment_alerts():
    """Check and generate commitment deadline alerts."""
    alerts = commitment_manager.check_and_generate_alerts()
    return {"alerts_generated": len(alerts), "alerts": alerts}


@router.get("/commitments/{session_id}/panel")
async def get_commitments_panel(session_id: str):
    """Get 'Commitments Made' panel for query response screen."""
    return commitment_manager.get_commitments_made_panel(session_id)
