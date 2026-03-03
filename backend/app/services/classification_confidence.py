"""
Classification Confidence System (Gap 11)

Implements confidence-aware M3 query classification with:
- Classification confidence threshold (0.75)
- Mandatory human confirmation for high-stakes categories (PV, Compliance, Insurance)
- Top-2 candidate presentation for low confidence
- Classification feedback loop
"""

import json
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.config.llm_config import LLMConfig

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class ClassificationCandidate(BaseModel):
    """Single classification candidate with confidence"""
    category_id: str
    category_name: str
    confidence: float
    reasoning: str = ""


class ClassificationResult(BaseModel):
    """Full classification result with routing decision"""
    top_category: ClassificationCandidate
    top_candidates: List[ClassificationCandidate]
    confidence: float
    requires_confirmation: bool
    routing: str  # AUTO_PROCEED, HUMAN_CONFIRMATION_REQUIRED, LOW_CONFIDENCE_REVIEW
    all_candidates: List[ClassificationCandidate] = Field(default_factory=list)


class ConfirmationRequest(BaseModel):
    """Pending human confirmation of classification"""
    confirmation_id: str = Field(default_factory=lambda: f"confirm-{uuid.uuid4()}")
    session_id: str
    query: str
    top_candidates: List[ClassificationCandidate]
    reason: str  # "high_stakes_category" or "low_confidence"
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "PENDING"  # PENDING, CONFIRMED, EXPIRED
    selected_category: Optional[str] = None
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None


class FeedbackEntry(BaseModel):
    """Misclassification feedback from user edits"""
    session_id: str
    query: str
    category: str
    edit_similarity: float
    flagged_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "NEEDS_REVIEW"


# ──────────────────────────────────────────────────────
# Classification Confidence Manager
# ──────────────────────────────────────────────────────

class ClassificationConfidenceManager:
    """
    Manages classification confidence thresholds and routing.

    Rules:
    1. High-stakes categories (CAT-07, CAT-09, CAT-12) ALWAYS require confirmation
    2. Confidence < 0.75 requires confirmation (top-2 presented)
    3. Confidence >= 0.75 on non-high-stakes auto-proceeds
    """

    def __init__(self):
        self.threshold = LLMConfig.CLASSIFICATION_CONFIDENCE_THRESHOLD
        self.high_stakes = LLMConfig.HIGH_STAKES_CATEGORIES
        self.pending_confirmations: Dict[str, ConfirmationRequest] = {}
        self.feedback_log: List[FeedbackEntry] = []

    def assess_classification(
        self,
        candidates: List[Dict],
        session_id: str
    ) -> ClassificationResult:
        """
        Assess classification candidates and determine routing.

        Args:
            candidates: List of {"category_id", "category_name", "confidence", "reasoning"}
            session_id: Current session ID

        Returns:
            ClassificationResult with routing decision
        """
        # Parse candidates
        parsed = [ClassificationCandidate(**c) for c in candidates]

        # Sort by confidence descending
        parsed.sort(key=lambda x: x.confidence, reverse=True)

        top = parsed[0] if parsed else None
        if not top:
            raise ValueError("No classification candidates provided")

        top_candidates = parsed[:LLMConfig.TOP_CANDIDATES_COUNT]
        confidence = top.confidence

        # Determine if confirmation required
        requires_confirmation = self._requires_confirmation(
            category=top.category_id,
            confidence=confidence
        )

        # Determine routing
        if requires_confirmation and top.category_id in self.high_stakes:
            routing = "HUMAN_CONFIRMATION_REQUIRED"
        elif confidence < self.threshold:
            routing = "LOW_CONFIDENCE_REVIEW"
        elif requires_confirmation:
            routing = "HUMAN_CONFIRMATION_REQUIRED"
        else:
            routing = "AUTO_PROCEED"

        logger.info(
            f"Classification assessed: {top.category_id} "
            f"(confidence: {confidence:.2f}, routing: {routing})",
            extra={
                "session_id": session_id,
                "category": top.category_id,
                "confidence": confidence,
                "routing": routing,
                "high_stakes": top.category_id in self.high_stakes
            }
        )

        return ClassificationResult(
            top_category=top,
            top_candidates=top_candidates,
            confidence=confidence,
            requires_confirmation=requires_confirmation,
            routing=routing,
            all_candidates=parsed
        )

    def _requires_confirmation(self, category: str, confidence: float) -> bool:
        """Check if human confirmation is required"""
        # High-stakes categories ALWAYS require confirmation
        if category in self.high_stakes:
            return True
        # Low confidence requires confirmation
        if confidence < self.threshold:
            return True
        return False

    # ── Human Confirmation ──

    def request_confirmation(
        self,
        session_id: str,
        query: str,
        top_candidates: List[ClassificationCandidate],
        reason: str
    ) -> str:
        """Create a confirmation request, return confirmation_id"""
        request = ConfirmationRequest(
            session_id=session_id,
            query=query,
            top_candidates=top_candidates,
            reason=reason
        )
        self.pending_confirmations[request.confirmation_id] = request

        logger.info(
            f"Confirmation requested: {request.confirmation_id} ({reason})",
            extra={
                "confirmation_id": request.confirmation_id,
                "session_id": session_id,
                "reason": reason,
                "top_candidate": top_candidates[0].category_id if top_candidates else None
            }
        )
        return request.confirmation_id

    def record_confirmation(
        self,
        confirmation_id: str,
        selected_category: str,
        user_id: str
    ) -> ConfirmationRequest:
        """Record the user's category selection"""
        request = self.pending_confirmations.get(confirmation_id)
        if not request:
            raise ValueError(f"Confirmation not found: {confirmation_id}")

        request.status = "CONFIRMED"
        request.selected_category = selected_category
        request.confirmed_by = user_id
        request.confirmed_at = datetime.utcnow()

        # Check if user overrode prediction
        predicted = request.top_candidates[0].category_id if request.top_candidates else None
        if selected_category != predicted:
            logger.warning(
                f"User overrode classification: {predicted} -> {selected_category}",
                extra={
                    "confirmation_id": confirmation_id,
                    "predicted": predicted,
                    "selected": selected_category,
                    "misclassification": True
                }
            )

        return request

    def get_pending_confirmations(self, session_id: Optional[str] = None) -> List[ConfirmationRequest]:
        """Get pending confirmations, optionally filtered by session"""
        pending = [r for r in self.pending_confirmations.values() if r.status == "PENDING"]
        if session_id:
            pending = [r for r in pending if r.session_id == session_id]
        return pending

    # ── Feedback Loop ──

    def log_edit_feedback(
        self,
        session_id: str,
        query: str,
        category: str,
        edit_similarity: float
    ):
        """
        Log significant user edits as potential misclassification signals.

        If edit_similarity < 0.70 (>30% change), flag for review.
        """
        if edit_similarity < LLMConfig.COMMITMENT_EDIT_SIMILARITY_THRESHOLD:
            entry = FeedbackEntry(
                session_id=session_id,
                query=query,
                category=category,
                edit_similarity=edit_similarity
            )
            self.feedback_log.append(entry)

            logger.warning(
                f"Significant edit detected (similarity: {edit_similarity:.2f}), "
                f"potential misclassification for {category}",
                extra={
                    "session_id": session_id,
                    "category": category,
                    "edit_similarity": edit_similarity
                }
            )

    def get_misclassification_patterns(self) -> List[Dict]:
        """Identify categories with high edit rates"""
        category_edits: Dict[str, List[float]] = {}
        for entry in self.feedback_log:
            cat = entry.category
            if cat not in category_edits:
                category_edits[cat] = []
            category_edits[cat].append(entry.edit_similarity)

        patterns = []
        for category, similarities in category_edits.items():
            avg = sum(similarities) / len(similarities) if similarities else 1.0
            patterns.append({
                "category": category,
                "total_flagged_edits": len(similarities),
                "avg_edit_similarity": round(avg, 3),
                "needs_attention": avg < 0.70
            })

        return sorted(patterns, key=lambda x: x["avg_edit_similarity"])


# Global instance
classification_confidence_manager = ClassificationConfidenceManager()
