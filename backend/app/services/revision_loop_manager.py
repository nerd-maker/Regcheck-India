"""
Revision Loop Termination System (Gap 6)

Prevents infinite M2→M1→M2 revision cycles with:
- Max revision attempts (3) per section
- DATA_GAP vs LANGUAGE_GAP classification
- Stuck section detection
- Immediate escalation for DATA_GAP issues
- Placeholder generation for human completion
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.core.datetime_utils import utc_now

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────

MAX_REVISION_ATTEMPTS = 3
STUCK_THRESHOLD = 2  # Same issues after N revisions = stuck


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class RevisionIssue(BaseModel):
    """A compliance issue identified during M1 evaluation"""
    issue_id: str
    section_name: str
    description: str
    gap_type: str = "LANGUAGE_GAP"  # DATA_GAP or LANGUAGE_GAP
    regulatory_reference: str = ""
    severity: str = "MAJOR"  # CRITICAL, MAJOR, MINOR


class RevisionAttempt(BaseModel):
    """Record of a single revision attempt"""
    attempt_number: int
    section_name: str
    issues_addressed: List[str] = Field(default_factory=list)
    issues_remaining: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=utc_now)
    outcome: str = "PENDING"  # RESOLVED, PARTIAL, STUCK, ESCALATED


class SectionRevisionState(BaseModel):
    """Tracks revision state for a single section"""
    section_name: str
    current_attempt: int = 0
    max_attempts: int = MAX_REVISION_ATTEMPTS
    attempts: List[RevisionAttempt] = Field(default_factory=list)
    current_issues: List[RevisionIssue] = Field(default_factory=list)
    resolved_issues: List[str] = Field(default_factory=list)
    status: str = "IN_PROGRESS"  # IN_PROGRESS, RESOLVED, ESCALATED, STUCK
    escalation_reason: Optional[str] = None
    placeholder_content: Optional[str] = None


class EscalationRecord(BaseModel):
    """Record of a section escalated for human completion"""
    section_name: str
    reason: str
    gap_type: str
    unresolved_issues: List[RevisionIssue] = Field(default_factory=list)
    attempts_made: int = 0
    placeholder: str = ""
    escalated_at: datetime = Field(default_factory=utc_now)


# ──────────────────────────────────────────────────────
# Revision Loop Manager
# ──────────────────────────────────────────────────────

class RevisionLoopManager:
    """
    Manages M2→M1→M2 revision cycles with termination guarantees.

    Rules:
    1. Max 3 revision attempts per section
    2. DATA_GAP issues escalate immediately (LLM can't fix missing data)
    3. Same issues recurring = section is STUCK → escalate
    4. Escalated sections get placeholder content for human completion
    """

    def __init__(self):
        self.sections: Dict[str, SectionRevisionState] = {}
        self.escalations: List[EscalationRecord] = []

    def init_section(self, section_name: str, issues: List[RevisionIssue]) -> SectionRevisionState:
        """Initialize revision tracking for a section."""
        state = SectionRevisionState(
            section_name=section_name,
            current_issues=issues
        )
        self.sections[section_name] = state
        return state

    def should_revise(self, section_name: str) -> Dict:
        """
        Determine if a section should be revised or escalated.

        Returns:
            {"action": "REVISE" | "ESCALATE" | "ACCEPT",
             "reason": str,
             "attempt": int}
        """
        state = self.sections.get(section_name)
        if not state:
            return {"action": "ACCEPT", "reason": "No issues tracked", "attempt": 0}

        if not state.current_issues:
            return {"action": "ACCEPT", "reason": "All issues resolved", "attempt": state.current_attempt}

        # Check for DATA_GAP — escalate immediately
        data_gaps = [i for i in state.current_issues if i.gap_type == "DATA_GAP"]
        if data_gaps:
            return {
                "action": "ESCALATE",
                "reason": f"DATA_GAP detected: {data_gaps[0].description}. "
                          f"LLM cannot generate missing data — requires human input.",
                "attempt": state.current_attempt,
                "gap_type": "DATA_GAP"
            }

        # Check max attempts
        if state.current_attempt >= state.max_attempts:
            return {
                "action": "ESCALATE",
                "reason": f"Max revision attempts ({state.max_attempts}) reached. "
                          f"{len(state.current_issues)} issues remain.",
                "attempt": state.current_attempt,
                "gap_type": "MAX_ATTEMPTS"
            }

        # Check if stuck (same issues recurring)
        if self._is_stuck(state):
            return {
                "action": "ESCALATE",
                "reason": "Section is STUCK — same issues persist after multiple revisions.",
                "attempt": state.current_attempt,
                "gap_type": "STUCK"
            }

        return {
            "action": "REVISE",
            "reason": f"{len(state.current_issues)} issues to address "
                      f"(attempt {state.current_attempt + 1}/{state.max_attempts})",
            "attempt": state.current_attempt + 1
        }

    def record_revision(
        self,
        section_name: str,
        resolved_ids: List[str],
        remaining_issues: List[RevisionIssue]
    ) -> SectionRevisionState:
        """Record the outcome of a revision attempt."""
        state = self.sections.get(section_name)
        if not state:
            raise ValueError(f"Section not tracked: {section_name}")

        state.current_attempt += 1

        attempt = RevisionAttempt(
            attempt_number=state.current_attempt,
            section_name=section_name,
            issues_addressed=resolved_ids,
            issues_remaining=[i.issue_id for i in remaining_issues]
        )

        if not remaining_issues:
            attempt.outcome = "RESOLVED"
            state.status = "RESOLVED"
        elif len(remaining_issues) < len(state.current_issues):
            attempt.outcome = "PARTIAL"
        else:
            attempt.outcome = "STUCK"

        state.attempts.append(attempt)
        state.resolved_issues.extend(resolved_ids)
        state.current_issues = remaining_issues

        logger.info(
            f"Revision recorded: {section_name} attempt {state.current_attempt} → {attempt.outcome}",
            extra={
                "section": section_name,
                "attempt": state.current_attempt,
                "resolved": len(resolved_ids),
                "remaining": len(remaining_issues)
            }
        )

        return state

    def escalate_section(self, section_name: str, reason: str) -> EscalationRecord:
        """Escalate section for human completion with placeholder."""
        state = self.sections.get(section_name)
        if not state:
            raise ValueError(f"Section not tracked: {section_name}")

        state.status = "ESCALATED"
        state.escalation_reason = reason

        # Generate placeholder content for human to complete
        placeholder = self._generate_placeholder(state)
        state.placeholder_content = placeholder

        record = EscalationRecord(
            section_name=section_name,
            reason=reason,
            gap_type="DATA_GAP" if any(i.gap_type == "DATA_GAP" for i in state.current_issues) else "LANGUAGE_GAP",
            unresolved_issues=state.current_issues,
            attempts_made=state.current_attempt,
            placeholder=placeholder
        )
        self.escalations.append(record)

        logger.warning(
            f"Section ESCALATED: {section_name} after {state.current_attempt} attempts. "
            f"Reason: {reason}",
            extra={
                "section": section_name,
                "attempts": state.current_attempt,
                "unresolved_count": len(state.current_issues)
            }
        )

        return record

    def _is_stuck(self, state: SectionRevisionState) -> bool:
        """Detect if section is stuck (same issues persist across attempts)."""
        if len(state.attempts) < STUCK_THRESHOLD:
            return False

        recent = state.attempts[-STUCK_THRESHOLD:]
        # If last N attempts all have same remaining issues, it's stuck
        remaining_sets = [set(a.issues_remaining) for a in recent]
        if all(s == remaining_sets[0] for s in remaining_sets) and remaining_sets[0]:
            return True
        return False

    def _generate_placeholder(self, state: SectionRevisionState) -> str:
        """Generate placeholder content listing what human needs to complete."""
        lines = [
            f"[REQUIRES HUMAN COMPLETION]",
            f"Section: {state.section_name}",
            f"AI revision attempts: {state.current_attempt}/{state.max_attempts}",
            "",
            "The following issues could not be resolved automatically:",
        ]

        for issue in state.current_issues:
            lines.append(f"  • [{issue.gap_type}] {issue.description}")
            if issue.regulatory_reference:
                lines.append(f"    Reference: {issue.regulatory_reference}")

        lines.append("")
        lines.append("Please provide the required information to complete this section.")

        return "\n".join(lines)

    def get_escalation_summary(self) -> Dict:
        """Get summary of all escalated sections."""
        return {
            "total_escalated": len(self.escalations),
            "by_gap_type": {
                "DATA_GAP": len([e for e in self.escalations if e.gap_type == "DATA_GAP"]),
                "LANGUAGE_GAP": len([e for e in self.escalations if e.gap_type == "LANGUAGE_GAP"]),
                "MAX_ATTEMPTS": len([e for e in self.escalations if e.gap_type not in ("DATA_GAP", "LANGUAGE_GAP")]),
            },
            "sections": [
                {
                    "section": e.section_name,
                    "reason": e.reason,
                    "attempts": e.attempts_made,
                    "issues": len(e.unresolved_issues)
                }
                for e in self.escalations
            ]
        }


# Global instance
revision_loop_manager = RevisionLoopManager()
