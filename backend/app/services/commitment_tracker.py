"""
Commitment Tracking System (Gap 16)

Full commitment lifecycle management:
- Extract commitments from M3 query responses
- Dashboard with all active commitments across submissions
- T-7 and T-2 day deadline alerts
- One-click mark-complete with mandatory evidence
- PM tool webhook integration (Jira/Asana/email)
- Prominent "Commitments Made" panel
"""

import re
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, Field

from app.config.llm_config import LLMConfig

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class CommitmentEvidence(BaseModel):
    """Evidence attached to commitment completion"""
    evidence_type: str  # document, email, note
    content: str
    file_url: Optional[str] = None
    recorded_at: datetime = Field(default_factory=datetime.utcnow)
    recorded_by: str = ""


class Commitment(BaseModel):
    """Tracked commitment from query response"""
    commitment_id: str = Field(default_factory=lambda: f"commit-{uuid.uuid4()}")

    # Source context
    session_id: str
    submission_id: str
    query_id: str
    response_text_snippet: str = ""

    # Commitment details
    commitment_text: str  # Exact commitment language
    action_required: str  # What needs to be done
    commitment_deadline: datetime

    # Assignment
    assigned_owner: Optional[str] = None
    assigned_at: Optional[datetime] = None

    # Status
    status: str = "PENDING"  # PENDING, IN_PROGRESS, COMPLETE, OVERDUE

    # Completion evidence (MANDATORY for marking complete)
    completion_evidence: Optional[CommitmentEvidence] = None
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None

    # Alerts
    alerts_sent: List[Dict] = Field(default_factory=list)

    # Metadata
    customer_id: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    urgency: str = "MEDIUM"  # HIGH, MEDIUM, LOW


class CommitmentsDashboardData(BaseModel):
    """Dashboard summary data"""
    total_active: int = 0
    overdue: int = 0
    pending: int = 0
    in_progress: int = 0
    completed: int = 0
    commitments: List[Dict] = Field(default_factory=list)


# ──────────────────────────────────────────────────────
# Commitment Extractor
# ──────────────────────────────────────────────────────

# Regex patterns for commitment detection in responses
COMMITMENT_PATTERNS = [
    r"we will (?:provide|submit|update|send|prepare|include|furnish) .+? within (\d+) (?:days|business days|working days)",
    r"will be (?:provided|submitted|updated|sent|furnished) (?:by|within|before) .+",
    r"the sponsor (?:commits|agrees|undertakes|shall) to .+",
    r"(?:amended|revised|updated) .+? will be (?:submitted|provided) .+",
    r"we (?:commit|agree|undertake) to .+? (?:within|by|before) .+",
]


class CommitmentExtractor:
    """Extracts commitments from M3 query response text using pattern matching."""

    def extract_commitments(
        self,
        response_text: str,
        session_id: str,
        submission_id: str,
        query_id: str,
        customer_id: str = ""
    ) -> List[Commitment]:
        """
        Extract commitments from response text using regex patterns.

        For production, supplement with LLM-based extraction.
        """
        commitments = []
        sentences = re.split(r'[.;]', response_text)

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            for pattern in COMMITMENT_PATTERNS:
                match = re.search(pattern, sentence, re.IGNORECASE)
                if match:
                    # Extract deadline days if in pattern
                    days = 7  # default
                    try:
                        days = int(match.group(1))
                    except (IndexError, ValueError, TypeError):
                        pass

                    commitment = Commitment(
                        session_id=session_id,
                        submission_id=submission_id,
                        query_id=query_id,
                        response_text_snippet=sentence[:200],
                        commitment_text=sentence[:300],
                        action_required=sentence[:200],
                        commitment_deadline=datetime.utcnow() + timedelta(days=days),
                        customer_id=customer_id
                    )
                    commitments.append(commitment)
                    break  # One commitment per sentence

        logger.info(
            f"Extracted {len(commitments)} commitments from response",
            extra={
                "session_id": session_id,
                "query_id": query_id,
                "count": len(commitments)
            }
        )

        return commitments


# ──────────────────────────────────────────────────────
# Commitment Manager
# ──────────────────────────────────────────────────────

class CommitmentManager:
    """
    Full commitment lifecycle management.

    Provides dashboard data, deadline alerts, completion tracking,
    and PM tool integration.
    """

    def __init__(self):
        self.commitments: List[Commitment] = []
        self.extractor = CommitmentExtractor()

    # ── Core Operations ──

    def add_commitment(self, commitment: Commitment) -> str:
        """Add a commitment to the tracker."""
        self.commitments.append(commitment)
        logger.info(
            f"Commitment added: {commitment.commitment_id} "
            f"(deadline: {commitment.commitment_deadline.date()})",
            extra={"commitment_id": commitment.commitment_id}
        )
        return commitment.commitment_id

    def extract_and_store(
        self,
        response_text: str,
        session_id: str,
        submission_id: str,
        query_id: str,
        customer_id: str = ""
    ) -> List[Commitment]:
        """Extract commitments from response and store them."""
        extracted = self.extractor.extract_commitments(
            response_text=response_text,
            session_id=session_id,
            submission_id=submission_id,
            query_id=query_id,
            customer_id=customer_id
        )
        for c in extracted:
            self.add_commitment(c)
        return extracted

    def mark_complete(
        self,
        commitment_id: str,
        completed_by: str,
        evidence_type: str,
        evidence_content: str,
        evidence_file_url: Optional[str] = None
    ) -> bool:
        """
        Mark commitment complete with MANDATORY evidence.

        No completion without proof — audit trail of fulfillment.
        """
        if not evidence_content.strip():
            logger.error(f"Cannot complete {commitment_id}: evidence required")
            return False

        commitment = self._get(commitment_id)
        if not commitment:
            return False

        commitment.status = "COMPLETE"
        commitment.completed_at = datetime.utcnow()
        commitment.completed_by = completed_by
        commitment.completion_evidence = CommitmentEvidence(
            evidence_type=evidence_type,
            content=evidence_content,
            file_url=evidence_file_url,
            recorded_by=completed_by
        )

        logger.info(
            f"Commitment completed: {commitment_id} with {evidence_type} evidence",
            extra={"commitment_id": commitment_id, "completed_by": completed_by}
        )
        return True

    def mark_in_progress(self, commitment_id: str, owner: str) -> bool:
        """Assign and start working on commitment."""
        commitment = self._get(commitment_id)
        if not commitment:
            return False
        commitment.status = "IN_PROGRESS"
        commitment.assigned_owner = owner
        commitment.assigned_at = datetime.utcnow()
        return True

    # ── Dashboard ──

    def get_dashboard(
        self,
        customer_id: Optional[str] = None,
        submission_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> CommitmentsDashboardData:
        """Get dashboard data for the commitments view."""
        items = self.commitments

        if customer_id:
            items = [c for c in items if c.customer_id == customer_id]
        if submission_id:
            items = [c for c in items if c.submission_id == submission_id]
        if status:
            items = [c for c in items if c.status == status]

        # Refresh overdue status
        for c in items:
            if c.status not in ("COMPLETE",) and c.commitment_deadline < datetime.utcnow():
                c.status = "OVERDUE"

        # Sort: OVERDUE first, then by deadline
        status_order = {"OVERDUE": 0, "PENDING": 1, "IN_PROGRESS": 2, "COMPLETE": 3}
        items.sort(key=lambda c: (status_order.get(c.status, 4), c.commitment_deadline))

        overdue = [c for c in items if c.status == "OVERDUE"]
        pending = [c for c in items if c.status == "PENDING"]
        in_progress = [c for c in items if c.status == "IN_PROGRESS"]
        completed = [c for c in items if c.status == "COMPLETE"]

        return CommitmentsDashboardData(
            total_active=len(overdue) + len(pending) + len(in_progress),
            overdue=len(overdue),
            pending=len(pending),
            in_progress=len(in_progress),
            completed=len(completed),
            commitments=[
                {
                    "commitment_id": c.commitment_id,
                    "commitment_text": c.commitment_text[:100],
                    "submission_id": c.submission_id,
                    "deadline": c.commitment_deadline.isoformat(),
                    "days_remaining": (c.commitment_deadline - datetime.utcnow()).days,
                    "assigned_owner": c.assigned_owner,
                    "status": c.status
                }
                for c in items
            ]
        )

    # ── Alerts ──

    def check_and_generate_alerts(self) -> List[Dict]:
        """Check all commitments and generate deadline alerts."""
        alerts = []

        for commitment in self.commitments:
            if commitment.status == "COMPLETE":
                continue

            days_remaining = (commitment.commitment_deadline - datetime.utcnow()).days
            sent_types = {a.get("alert_type") for a in commitment.alerts_sent}

            for alert_day in LLMConfig.COMMITMENT_ALERT_DAYS:
                alert_type = f"T_{alert_day}"
                if days_remaining <= alert_day and alert_type not in sent_types:
                    alert = {
                        "alert_type": alert_type,
                        "commitment_id": commitment.commitment_id,
                        "commitment_text": commitment.commitment_text[:100],
                        "submission_id": commitment.submission_id,
                        "days_remaining": days_remaining,
                        "sent_at": datetime.utcnow().isoformat(),
                        "message": (
                            f"{'URGENT: ' if days_remaining <= 2 else ''}"
                            f"Commitment due in {days_remaining} days: "
                            f"{commitment.commitment_text[:80]}"
                        )
                    }
                    commitment.alerts_sent.append(alert)
                    alerts.append(alert)

            # Auto-mark overdue
            if days_remaining <= 0 and commitment.status != "OVERDUE":
                commitment.status = "OVERDUE"

        if alerts:
            logger.warning(
                f"Generated {len(alerts)} commitment deadline alerts",
                extra={"alert_count": len(alerts)}
            )

        return alerts

    # ── Commitments Made Panel ──

    def get_commitments_made_panel(
        self,
        session_id: str
    ) -> Dict:
        """
        Get prominent panel data for the query response screen.

        Shows commitments made in this response — NOT buried in metadata.
        """
        session_commitments = [
            c for c in self.commitments if c.session_id == session_id
        ]

        if not session_commitments:
            return {"count": 0, "items": [], "warning": None}

        return {
            "count": len(session_commitments),
            "items": [
                {
                    "commitment_text": c.commitment_text,
                    "action_required": c.action_required,
                    "deadline": c.commitment_deadline.isoformat(),
                    "days_until": (c.commitment_deadline - datetime.utcnow()).days,
                    "status": c.status
                }
                for c in session_commitments
            ],
            "warning": (
                f"⚠️ This response contains {len(session_commitments)} "
                f"commitment(s) that require follow-up action."
            )
        }

    # ── PM Tool Webhooks ──

    def build_webhook_payload(self, commitment: Commitment) -> Dict:
        """Build webhook payload for Jira/Asana/email integration."""
        return {
            "title": f"[CDSCO Commitment] {commitment.action_required[:80]}",
            "description": commitment.commitment_text,
            "due_date": commitment.commitment_deadline.isoformat(),
            "priority": "HIGH" if commitment.urgency == "HIGH" else "MEDIUM",
            "labels": [
                "regulatory",
                "commitment",
                commitment.submission_id
            ],
            "metadata": {
                "commitment_id": commitment.commitment_id,
                "session_id": commitment.session_id,
                "customer_id": commitment.customer_id
            }
        }

    # ── Internal ──

    def _get(self, commitment_id: str) -> Optional[Commitment]:
        """Find commitment by ID."""
        for c in self.commitments:
            if c.commitment_id == commitment_id:
                return c
        return None


# Global instance
commitment_manager = CommitmentManager()
