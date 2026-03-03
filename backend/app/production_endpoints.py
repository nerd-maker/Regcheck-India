
"""
Production Safety API Endpoints
Session management, review queue, and KB version management
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.services.session_manager import session_manager
from app.services.review_queue import review_queue
from app.services.kb_version_manager import kb_version_manager
from app.config.llm_config import LLMConfig

router = APIRouter(prefix="/api/v1", tags=["Production Safety"])


# Session Management Endpoints
@router.post("/sessions")
async def create_session(
    submission_id: str,
    user_id: str,
    metadata: dict = None
):
    """
    Create new session for audit trail tracking
    
    Returns session_id to be used in X-Session-ID header for all subsequent requests
    """
    session_id = session_manager.create_session(
        submission_id=submission_id,
        user_id=user_id,
        metadata=metadata
    )
    
    return {
        "session_id": session_id,
        "submission_id": submission_id,
        "kb_version": session_manager.kb_version,
        "created_at": datetime.utcnow().isoformat()
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session details"""
    session = session_manager.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session


@router.get("/sessions/{session_id}/audit-trail")
async def get_audit_trail(session_id: str):
    """Get complete audit trail for a session"""
    audit_trail = session_manager.get_session_audit_trail(session_id)
    
    return {
        "session_id": session_id,
        "audit_trail": audit_trail,
        "entry_count": len(audit_trail)
    }


# Review Queue Endpoints
@router.get("/review-queue")
async def get_pending_reviews():
    """Get all items in review queue"""
    pending = review_queue.get_pending_reviews()
    
    return {
        "pending_reviews": pending,
        "count": len(pending)
    }


@router.get("/review-queue/{session_id}")
async def get_review_item(session_id: str):
    """Get specific review item"""
    item = review_queue.get_item(session_id)
    
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")
    
    return item


@router.post("/review-queue/{session_id}/approve")
async def approve_review(
    session_id: str,
    reviewer_id: str,
    notes: str = None
):
    """Approve review item"""
    success = review_queue.approve_item(
        session_id=session_id,
        reviewer_id=reviewer_id,
        notes=notes
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Review item not found")
    
    return {"status": "approved", "session_id": session_id}


@router.post("/review-queue/{session_id}/reject")
async def reject_review(
    session_id: str,
    reviewer_id: str,
    notes: str
):
    """Reject review item"""
    success = review_queue.reject_item(
        session_id=session_id,
        reviewer_id=reviewer_id,
        notes=notes
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Review item not found")
    
    return {"status": "rejected", "session_id": session_id}


# KB Version Management Endpoints
@router.get("/kb-version")
async def get_kb_version():
    """Get current knowledge base version"""
    return {
        "current_version": kb_version_manager.get_current_version(),
        "version_history": kb_version_manager.version_history
    }


@router.post("/kb-version/update")
async def update_kb_version(
    new_version: str,
    change_summary: str,
    source_documents: list
):
    """
    Update knowledge base version
    
    Triggers re-evaluation of all pending submissions
    """
    new_kb_version = kb_version_manager.update_version(
        new_version=new_version,
        change_summary=change_summary,
        source_documents=source_documents
    )
    
    return {
        "new_version": new_kb_version.version,
        "change_summary": new_kb_version.change_summary,
        "revalidation_queue_size": len(kb_version_manager.get_revalidation_queue())
    }


@router.get("/kb-version/revalidation-queue")
async def get_revalidation_queue():
    """Get pending revalidation tasks"""
    queue = kb_version_manager.get_revalidation_queue()
    
    return {
        "revalidation_tasks": queue,
        "count": len(queue)
    }


# LLM Configuration Endpoint
@router.get("/config/llm")
async def get_llm_config():
    """Get LLM configuration (temperature and token budgets)"""
    return {
        "temperatures": LLMConfig.MODULE_TEMPERATURES,
        "max_tokens": LLMConfig.MODULE_MAX_TOKENS,
        "model": LLMConfig.LLM_MODEL
    }
