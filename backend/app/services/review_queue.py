"""
Confidence Threshold Management
Implements Rule 3: Block low-confidence outputs and route to human review
"""

from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ConfidenceLevel(str, Enum):
    """Confidence level thresholds"""
    HIGH = "HIGH"          # ≥ 0.85
    MEDIUM = "MEDIUM"      # 0.70 - 0.84
    LOW = "LOW"            # < 0.70


class ConfidenceResult(BaseModel):
    """Confidence assessment result"""
    confidence_level: ConfidenceLevel
    confidence_score: float = Field(ge=0.0, le=1.0)
    requires_human_review: bool
    review_reasons: List[str] = Field(default_factory=list)


class ReviewQueueItem(BaseModel):
    """Item in human review queue"""
    session_id: str
    module: str
    operation: str
    content: dict
    confidence: ConfidenceResult
    reason: str
    queued_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "PENDING"  # PENDING, IN_REVIEW, APPROVED, REJECTED
    reviewer_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = None


class ReviewQueue:
    """
    Human review queue for low-confidence outputs
    
    Production Note: Replace in-memory storage with database
    """
    
    def __init__(self):
        self.queue: List[ReviewQueueItem] = []
    
    def add_to_queue(
        self,
        session_id: str,
        module: str,
        operation: str,
        content: dict,
        confidence: ConfidenceResult,
        reason: str
    ) -> ReviewQueueItem:
        """Add item to review queue"""
        item = ReviewQueueItem(
            session_id=session_id,
            module=module,
            operation=operation,
            content=content,
            confidence=confidence,
            reason=reason
        )
        
        self.queue.append(item)
        
        logger.warning(
            f"Added to review queue: {module}.{operation}",
            extra={
                "session_id": session_id,
                "confidence": confidence.confidence_score,
                "reason": reason
            }
        )
        
        return item
    
    def get_pending_reviews(self) -> List[ReviewQueueItem]:
        """Get all pending review items"""
        return [item for item in self.queue if item.status == "PENDING"]
    
    def get_item(self, session_id: str) -> Optional[ReviewQueueItem]:
        """Get review item by session ID"""
        for item in self.queue:
            if item.session_id == session_id:
                return item
        return None
    
    def approve_item(
        self,
        session_id: str,
        reviewer_id: str,
        notes: Optional[str] = None
    ) -> bool:
        """Approve review item"""
        item = self.get_item(session_id)
        if not item:
            return False
        
        item.status = "APPROVED"
        item.reviewer_id = reviewer_id
        item.reviewed_at = datetime.utcnow()
        item.reviewer_notes = notes
        
        logger.info(
            f"Review item approved: {session_id}",
            extra={"reviewer_id": reviewer_id}
        )
        
        return True
    
    def reject_item(
        self,
        session_id: str,
        reviewer_id: str,
        notes: str
    ) -> bool:
        """Reject review item"""
        item = self.get_item(session_id)
        if not item:
            return False
        
        item.status = "REJECTED"
        item.reviewer_id = reviewer_id
        item.reviewed_at = datetime.utcnow()
        item.reviewer_notes = notes
        
        logger.info(
            f"Review item rejected: {session_id}",
            extra={"reviewer_id": reviewer_id}
        )
        
        return True
    
    def clear_queue(self):
        """Clear all items from the review queue"""
        self.queue.clear()


def assess_confidence(score: float) -> ConfidenceResult:
    """
    Assess confidence level from score
    
    Thresholds:
    - HIGH: ≥ 0.85
    - MEDIUM: 0.70 - 0.84
    - LOW: < 0.70
    """
    if score >= 0.85:
        return ConfidenceResult(
            confidence_level=ConfidenceLevel.HIGH,
            confidence_score=score,
            requires_human_review=False,
            review_reasons=[]
        )
    elif score >= 0.70:
        return ConfidenceResult(
            confidence_level=ConfidenceLevel.MEDIUM,
            confidence_score=score,
            requires_human_review=False,
            review_reasons=["Medium confidence - recommend spot check"]
        )
    else:
        return ConfidenceResult(
            confidence_level=ConfidenceLevel.LOW,
            confidence_score=score,
            requires_human_review=True,
            review_reasons=["Low confidence - mandatory human review"]
        )


# Global review queue instance
review_queue = ReviewQueue()
