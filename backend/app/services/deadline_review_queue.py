"""
Deadline-Aware Review Queue (Gap 12)

Extends the basic review queue with:
- deadline_date field for all queue items
- Priority-based ordering (deadline proximity, not FIFO)
- Escalating alerts (T-14/T-7/T-3/T-0 days)
- 2-hour SLA for flagging items to customers
- Dashboard API data
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, Field

from app.config.llm_config import LLMConfig
from app.core.datetime_utils import utc_now

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class DeadlineReviewItem(BaseModel):
    """Review queue item with deadline tracking"""
    queue_id: str = Field(default_factory=lambda: f"queue-{uuid.uuid4()}")
    session_id: str

    # Item details
    item_type: str  # M1_FINDING, M2_SECTION, M3_RESPONSE, TRANSLATION
    module: str  # M1, M2, M3, M4

    # Content
    input_data: Dict = Field(default_factory=dict)
    output_data: Dict = Field(default_factory=dict)
    confidence_score: float = 0.0
    confidence_signals: Dict = Field(default_factory=dict)

    # Deadline tracking (REQUIRED)
    deadline_date: datetime
    deadline_type: str  # CDSCO_QUERY, EC_SUBMISSION, INTERNAL_REVIEW
    days_until_deadline: int = 0

    # Priority (computed from deadline proximity)
    priority: str = "LOW"  # CRITICAL, HIGH, MEDIUM, LOW

    # Status
    status: str = "PENDING"  # PENDING, IN_REVIEW, APPROVED, REJECTED, ESCALATED

    # Assignment
    assigned_to: Optional[str] = None
    assigned_at: Optional[datetime] = None

    # Timestamps
    created_at: datetime = Field(default_factory=utc_now)
    flagged_to_customer_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None

    # Alerts sent
    alerts_sent: List[Dict] = Field(default_factory=list)

    # Context
    customer_id: str = ""
    submission_id: Optional[str] = None


class AlertRecord(BaseModel):
    """Record of an alert sent"""
    alert_type: str  # T_14, T_7, T_3, T_0
    sent_at: datetime = Field(default_factory=utc_now)
    recipients: List[str] = Field(default_factory=list)
    channels: List[str] = Field(default_factory=list)  # email, in_app_banner


# ──────────────────────────────────────────────────────
# Deadline-Aware Review Queue Manager
# ──────────────────────────────────────────────────────

class DeadlineReviewQueueManager:
    """
    Review queue with deadline-aware prioritization.

    Items ordered by deadline proximity, NOT FIFO.
    Escalating alerts at T-14, T-7, T-3, T-0 days.
    2-hour SLA for flagging to customers.
    """

    def __init__(self):
        self.queue: List[DeadlineReviewItem] = []
        self.sla_hours = LLMConfig.REVIEW_QUEUE_SLA_HOURS

    def add_to_queue(
        self,
        session_id: str,
        item_type: str,
        module: str,
        deadline_date: datetime,
        deadline_type: str,
        input_data: Dict = None,
        output_data: Dict = None,
        confidence_score: float = 0.0,
        confidence_signals: Dict = None,
        customer_id: str = "",
        submission_id: Optional[str] = None
    ) -> str:
        """Add item with deadline to review queue."""
        days_until = (deadline_date - utc_now()).days
        priority = LLMConfig.compute_review_priority(days_until)

        item = DeadlineReviewItem(
            session_id=session_id,
            item_type=item_type,
            module=module,
            input_data=input_data or {},
            output_data=output_data or {},
            confidence_score=confidence_score,
            confidence_signals=confidence_signals or {},
            deadline_date=deadline_date,
            deadline_type=deadline_type,
            days_until_deadline=days_until,
            priority=priority,
            customer_id=customer_id,
            submission_id=submission_id
        )

        self.queue.append(item)
        self._reorder_queue()

        logger.info(
            f"Added to deadline queue: {item.queue_id} "
            f"(deadline: {deadline_date.date()}, priority: {priority})",
            extra={
                "queue_id": item.queue_id,
                "deadline_date": str(deadline_date.date()),
                "days_until_deadline": days_until,
                "priority": priority
            }
        )

        return item.queue_id

    def _reorder_queue(self):
        """Reorder queue by priority then deadline (NOT FIFO)."""
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        self.queue.sort(
            key=lambda item: (
                priority_order.get(item.priority, 4),
                item.deadline_date
            )
        )

    def refresh_priorities(self):
        """Recalculate priorities and detect overdue items. Run periodically."""
        for item in self.queue:
            if item.status in ("APPROVED", "REJECTED"):
                continue
            days_until = (item.deadline_date - utc_now()).days
            item.days_until_deadline = days_until
            item.priority = LLMConfig.compute_review_priority(days_until)
            if days_until <= 0 and item.status != "ESCALATED":
                item.status = "ESCALATED"
                logger.critical(
                    f"DEADLINE REACHED for {item.queue_id} — item ESCALATED",
                    extra={"queue_id": item.queue_id}
                )
        self._reorder_queue()

    # ── Alert Checks ──

    def check_and_generate_alerts(self) -> List[Dict]:
        """
        Check all items and generate applicable alerts.
        Returns list of alerts to send. Run as a scheduled job.
        """
        alerts_to_send = []

        for item in self.queue:
            if item.status in ("APPROVED", "REJECTED"):
                continue

            days_until = (item.deadline_date - utc_now()).days
            sent_types = {a.get("alert_type") for a in item.alerts_sent}

            # T-14: Email to RA team lead
            if days_until <= 14 and "T_14" not in sent_types:
                alert = self._create_alert(item, "T_14", ["email"],
                    f"Review item {item.queue_id} due in {days_until} days")
                alerts_to_send.append(alert)

            # T-7: Email + in-app banner
            if days_until <= 7 and "T_7" not in sent_types:
                alert = self._create_alert(item, "T_7", ["email", "in_app_banner"],
                    f"URGENT: {item.queue_id} due in {days_until} days")
                alerts_to_send.append(alert)

            # T-3: Senior management escalation
            if days_until <= 3 and days_until > 0 and "T_3" not in sent_types:
                alert = self._create_alert(item, "T_3",
                    ["email", "in_app_banner", "senior_mgmt"],
                    f"CRITICAL: {item.queue_id} due in {days_until} days — escalating")
                alerts_to_send.append(alert)

            # T-0: Lock item
            if days_until <= 0 and "T_0" not in sent_types:
                item.status = "ESCALATED"
                alert = self._create_alert(item, "T_0", ["email", "lock"],
                    f"DEADLINE REACHED: {item.queue_id} — locked, override required")
                alerts_to_send.append(alert)

        return alerts_to_send

    def _create_alert(
        self,
        item: DeadlineReviewItem,
        alert_type: str,
        channels: List[str],
        message: str
    ) -> Dict:
        """Create an alert record and attach to item."""
        record = {
            "alert_type": alert_type,
            "sent_at": utc_now().isoformat(),
            "channels": channels,
            "message": message,
            "queue_id": item.queue_id
        }
        item.alerts_sent.append(record)

        # Use separate log_extra to avoid conflict with Python logging's
        # reserved 'message' attribute in LogRecord
        log_extra = {
            "alert_type": alert_type,
            "channels": channels,
            "alert_message": message,
            "alert_queue_id": item.queue_id
        }
        logger.warning(
            f"Alert generated: {alert_type} for {item.queue_id}",
            extra=log_extra
        )
        return record

    # ── SLA Tracking ──

    def flag_to_customer(self, queue_id: str) -> bool:
        """Mark item as flagged to customer. Returns True if within SLA."""
        item = self._get_item(queue_id)
        if not item:
            return False

        item.flagged_to_customer_at = utc_now()
        hours_elapsed = (item.flagged_to_customer_at - item.created_at).total_seconds() / 3600

        if hours_elapsed <= self.sla_hours:
            logger.info(f"SLA MET for {queue_id} (flagged in {hours_elapsed:.1f}h)")
            return True
        else:
            logger.warning(f"SLA MISSED for {queue_id} (flagged in {hours_elapsed:.1f}h)")
            return False

    # ── Query Methods ──

    def get_queue_items(
        self,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None
    ) -> List[DeadlineReviewItem]:
        """Get queue items (already ordered by priority/deadline)."""
        items = self.queue
        if customer_id:
            items = [i for i in items if i.customer_id == customer_id]
        if status:
            items = [i for i in items if i.status == status]
        if priority:
            items = [i for i in items if i.priority == priority]
        return items

    def get_dashboard_data(self, customer_id: Optional[str] = None) -> Dict:
        """Get dashboard summary for home screen widget."""
        self.refresh_priorities()
        items = self.get_queue_items(customer_id=customer_id)
        active = [i for i in items if i.status not in ("APPROVED", "REJECTED")]

        by_priority = {}
        for p in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
            p_items = [i for i in active if i.priority == p]
            by_priority[p] = {
                "count": len(p_items),
                "items": [
                    {
                        "queue_id": i.queue_id,
                        "module": i.module,
                        "deadline_date": i.deadline_date.isoformat(),
                        "days_until_deadline": i.days_until_deadline,
                        "status": i.status
                    }
                    for i in p_items[:5]
                ]
            }

        return {
            "total_active": len(active),
            "by_priority": by_priority,
            "sla_hours": self.sla_hours,
            "overdue_count": len([i for i in active if i.days_until_deadline <= 0])
        }

    def approve_item(self, queue_id: str, reviewer_id: str, notes: str = "") -> bool:
        """Approve a review queue item."""
        item = self._get_item(queue_id)
        if not item:
            return False
        item.status = "APPROVED"
        item.reviewed_at = utc_now()
        item.assigned_to = reviewer_id
        logger.info(f"Review item approved: {queue_id}", extra={"reviewer_id": reviewer_id})
        return True

    def override_escalated(self, queue_id: str, override_by: str, reason: str) -> bool:
        """Override a T-0 escalated/locked item (requires explicit justification)."""
        item = self._get_item(queue_id)
        if not item or item.status != "ESCALATED":
            return False
        item.status = "IN_REVIEW"
        item.alerts_sent.append({
            "alert_type": "OVERRIDE",
            "sent_at": utc_now().isoformat(),
            "override_by": override_by,
            "reason": reason
        })
        logger.warning(
            f"Escalated item overridden: {queue_id} by {override_by}",
            extra={"reason": reason}
        )
        return True

    def _get_item(self, queue_id: str) -> Optional[DeadlineReviewItem]:
        """Find item by queue_id."""
        for item in self.queue:
            if item.queue_id == queue_id:
                return item
        return None


# Global instance
deadline_review_queue = DeadlineReviewQueueManager()
