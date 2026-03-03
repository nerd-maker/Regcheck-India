"""
Immutable Audit Trail System with Operation State Machine

Implements GCP-compliant append-only audit trail with proper retry tracking.

State Machine:
  INITIATED → PROCESSING → COMPLETED
                        → FAILED
                        → RETRIED → SUPERSEDED

Key Features:
- Each retry gets new attempt_id
- Supersession links track retry chain
- Session points to final_output_attempt_id
- INSERT-only (never UPDATE or DELETE)
- Regulatory inspection ready
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Dict, List, Optional, Literal
from enum import Enum
import uuid
import hashlib
import json
import logging

logger = logging.getLogger(__name__)


class AttemptStatus(str, Enum):
    """Operation attempt status"""
    INITIATED = "INITIATED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRIED = "RETRIED"
    SUPERSEDED = "SUPERSEDED"


class OperationAttempt(BaseModel):
    """
    Single attempt at an operation (may be retried)
    
    IMMUTABLE: Once written, never updated or deleted
    """
    
    # Identity
    attempt_id: str = Field(default_factory=lambda: f"att-{uuid.uuid4()}")
    session_id: str
    operation_id: str  # Groups all attempts for same operation
    
    # Retry tracking
    attempt_number: int  # 1, 2, 3...
    supersedes_attempt_id: Optional[str] = None  # Links to previous attempt
    superseded_by_attempt_id: Optional[str] = None  # Links to next attempt
    
    # State machine
    status: AttemptStatus
    
    # Operation details
    module: str  # M1, M2, M3, M4
    operation: str  # evaluate_section, generate_document, etc.
    
    # Input/Output tracking
    input_hash: str
    output_hash: Optional[str] = None  # None if failed before output
    input_data: Optional[Dict] = None  # Optional: store actual input
    output_data: Optional[Dict] = None  # Optional: store actual output
    
    # LLM parameters
    temperature: float
    max_tokens: int
    actual_tokens: Optional[int] = None
    
    # Confidence assessment
    confidence_score: Optional[str] = None  # HIGH/MEDIUM/LOW
    confidence_signals: Optional[Dict] = None  # From multi-signal system
    
    # Timestamps (immutable)
    initiated_at: datetime
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    
    # Error tracking
    error_message: Optional[str] = None
    error_type: Optional[str] = None  # json_parse_error, llm_error, etc.
    
    # Metadata
    kb_version: str
    metadata: Dict = Field(default_factory=dict)
    
    # Immutability tracking
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SessionRecord(BaseModel):
    """
    Session-level record
    
    Only final_output_attempt_ids can be updated (append operation_ids)
    """
    
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    submission_id: str
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    kb_version: str
    
    # Final outputs (updated as operations complete)
    final_output_attempt_ids: Dict[str, str] = Field(default_factory=dict)  # operation_id → attempt_id
    
    # Metadata
    metadata: Dict = Field(default_factory=dict)


class AttemptManager:
    """
    Manages operation attempts with state machine
    
    Ensures immutable audit trail with proper retry tracking
    
    Production Note: This uses in-memory storage for development.
    Replace with PostgreSQL for production deployment.
    """
    
    def __init__(self):
        # In-memory storage (replace with PostgreSQL in production)
        self.attempts: Dict[str, List[OperationAttempt]] = {}  # attempt_id → [all versions]
        self.sessions: Dict[str, SessionRecord] = {}
        self.operations: Dict[str, List[str]] = {}  # operation_id → [attempt_ids]
    
    def create_session(
        self,
        submission_id: str,
        user_id: str,
        kb_version: str,
        metadata: Optional[Dict] = None
    ) -> str:
        """Create new session"""
        
        session = SessionRecord(
            submission_id=submission_id,
            user_id=user_id,
            kb_version=kb_version,
            metadata=metadata or {}
        )
        
        self.sessions[session.session_id] = session
        
        logger.info(
            f"Created session {session.session_id}",
            extra={"session_id": session.session_id, "submission_id": submission_id}
        )
        
        return session.session_id
    
    def initiate_operation(
        self,
        session_id: str,
        module: str,
        operation: str,
        input_data: Dict,
        temperature: float,
        max_tokens: int
    ) -> tuple[str, str]:
        """
        Start a new operation (creates attempt 1)
        
        Returns:
            (operation_id, attempt_id)
        """
        
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        operation_id = f"op-{uuid.uuid4()}"
        input_hash = hashlib.sha256(
            json.dumps(input_data, sort_keys=True).encode()
        ).hexdigest()[:16]
        
        attempt = OperationAttempt(
            session_id=session_id,
            operation_id=operation_id,
            attempt_number=1,
            status=AttemptStatus.INITIATED,
            module=module,
            operation=operation,
            input_hash=input_hash,
            input_data=input_data,
            temperature=temperature,
            max_tokens=max_tokens,
            kb_version=session.kb_version,
            initiated_at=datetime.utcnow()
        )
        
        # INSERT only (never UPDATE)
        self._insert_attempt(attempt)
        
        logger.info(
            f"Initiated operation {operation_id}, attempt 1",
            extra={
                "session_id": session_id,
                "attempt_id": attempt.attempt_id,
                "operation": f"{module}.{operation}"
            }
        )
        
        return operation_id, attempt.attempt_id
    
    def mark_processing(self, attempt_id: str):
        """
        Mark attempt as processing
        
        Creates NEW record with PROCESSING status (append-only)
        """
        
        current = self._get_latest_attempt(attempt_id)
        
        # Create new record with updated status
        updated = current.copy(update={
            "status": AttemptStatus.PROCESSING,
            "metadata": {
                **current.metadata,
                "processing_started_at": datetime.utcnow().isoformat()
            },
            "created_at": datetime.utcnow()
        })
        
        # INSERT new record (append-only)
        self._insert_attempt(updated)
        
        logger.debug(f"Marked attempt {attempt_id} as PROCESSING")
    
    def mark_completed(
        self,
        attempt_id: str,
        output_data: Dict,
        actual_tokens: int,
        confidence_assessment: Dict
    ):
        """
        Mark attempt as completed
        
        Updates session's final_output_attempt_id
        """
        
        current = self._get_latest_attempt(attempt_id)
        output_hash = hashlib.sha256(
            json.dumps(output_data, sort_keys=True).encode()
        ).hexdigest()[:16]
        
        # Create completed record
        completed = current.copy(update={
            "status": AttemptStatus.COMPLETED,
            "output_hash": output_hash,
            "output_data": output_data,
            "actual_tokens": actual_tokens,
            "confidence_score": confidence_assessment.get("overall_confidence"),
            "confidence_signals": confidence_assessment.get("all_signals"),
            "completed_at": datetime.utcnow(),
            "created_at": datetime.utcnow()
        })
        
        # INSERT completed record
        self._insert_attempt(completed)
        
        # Update session's final output pointer
        session = self.sessions[current.session_id]
        session.final_output_attempt_ids[current.operation_id] = attempt_id
        
        logger.info(
            f"Completed operation {current.operation_id}",
            extra={
                "session_id": current.session_id,
                "attempt_id": attempt_id,
                "confidence": confidence_assessment.get("overall_confidence")
            }
        )
    
    def mark_failed(
        self,
        attempt_id: str,
        error_message: str,
        error_type: str
    ):
        """
        Mark attempt as permanently failed (no retry)
        """
        
        current = self._get_latest_attempt(attempt_id)
        
        failed = current.copy(update={
            "status": AttemptStatus.FAILED,
            "error_message": error_message,
            "error_type": error_type,
            "failed_at": datetime.utcnow(),
            "created_at": datetime.utcnow()
        })
        
        self._insert_attempt(failed)
        
        logger.error(
            f"Operation failed: {current.operation_id}",
            extra={
                "session_id": current.session_id,
                "attempt_id": attempt_id,
                "error_type": error_type,
                "error_message": error_message
            }
        )
    
    def initiate_retry(
        self,
        original_attempt_id: str,
        error_message: str,
        error_type: str
    ) -> str:
        """
        Initiate retry of failed attempt
        
        1. Mark original as RETRIED
        2. Create new attempt with attempt_number + 1
        3. Link via supersedes_attempt_id
        4. Mark original as SUPERSEDED
        
        Returns:
            new_attempt_id
        """
        
        original = self._get_latest_attempt(original_attempt_id)
        
        # Mark original as RETRIED
        retried = original.copy(update={
            "status": AttemptStatus.RETRIED,
            "error_message": error_message,
            "error_type": error_type,
            "failed_at": datetime.utcnow(),
            "created_at": datetime.utcnow()
        })
        
        self._insert_attempt(retried)
        
        # Create new attempt
        new_attempt = OperationAttempt(
            session_id=original.session_id,
            operation_id=original.operation_id,
            attempt_number=original.attempt_number + 1,
            supersedes_attempt_id=original_attempt_id,
            status=AttemptStatus.INITIATED,
            module=original.module,
            operation=original.operation,
            input_hash=original.input_hash,
            input_data=original.input_data,
            temperature=original.temperature,
            max_tokens=original.max_tokens,
            kb_version=original.kb_version,
            initiated_at=datetime.utcnow(),
            metadata={
                "retry_of": original_attempt_id,
                "retry_reason": error_message
            }
        )
        
        self._insert_attempt(new_attempt)
        
        # Update original to mark as SUPERSEDED
        superseded = retried.copy(update={
            "status": AttemptStatus.SUPERSEDED,
            "superseded_by_attempt_id": new_attempt.attempt_id,
            "created_at": datetime.utcnow()
        })
        
        self._insert_attempt(superseded)
        
        logger.warning(
            f"Retrying operation {original.operation_id}, attempt {new_attempt.attempt_number}",
            extra={
                "session_id": original.session_id,
                "original_attempt_id": original_attempt_id,
                "new_attempt_id": new_attempt.attempt_id,
                "retry_reason": error_message
            }
        )
        
        return new_attempt.attempt_id
    
    def get_operation_history(self, operation_id: str) -> List[OperationAttempt]:
        """
        Get complete history of all attempts for an operation
        
        Returns attempts in chronological order
        """
        
        attempt_ids = self.operations.get(operation_id, [])
        attempts = []
        
        for attempt_id in attempt_ids:
            # Get latest version of each attempt
            attempts.append(self._get_latest_attempt(attempt_id))
        
        # Sort by attempt_number
        return sorted(attempts, key=lambda a: a.attempt_number)
    
    def get_final_attempt(self, session_id: str, operation_id: str) -> OperationAttempt:
        """
        Get the final attempt that was shown to user
        
        Uses session's final_output_attempt_id
        """
        
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        final_attempt_id = session.final_output_attempt_ids.get(operation_id)
        
        if not final_attempt_id:
            raise ValueError(f"No final output for operation {operation_id}")
        
        return self._get_latest_attempt(final_attempt_id)
    
    def get_session_audit_trail(self, session_id: str) -> List[OperationAttempt]:
        """
        Get complete audit trail for a session
        
        Returns all final attempts in chronological order
        """
        
        session = self.sessions.get(session_id)
        if not session:
            return []
        
        attempts = []
        for operation_id, attempt_id in session.final_output_attempt_ids.items():
            attempts.append(self._get_latest_attempt(attempt_id))
        
        # Sort by initiated_at
        return sorted(attempts, key=lambda a: a.initiated_at)
    
    def _insert_attempt(self, attempt: OperationAttempt):
        """
        Insert attempt record (append-only)
        
        In production, this would be INSERT INTO PostgreSQL
        """
        
        # Store all versions of this attempt
        if attempt.attempt_id not in self.attempts:
            self.attempts[attempt.attempt_id] = []
        
        self.attempts[attempt.attempt_id].append(attempt)
        
        # Track by operation_id
        if attempt.operation_id not in self.operations:
            self.operations[attempt.operation_id] = []
        
        if attempt.attempt_id not in self.operations[attempt.operation_id]:
            self.operations[attempt.operation_id].append(attempt.attempt_id)
    
    def _get_latest_attempt(self, attempt_id: str) -> OperationAttempt:
        """Get latest version of an attempt"""
        
        versions = self.attempts.get(attempt_id)
        if not versions:
            raise ValueError(f"Attempt not found: {attempt_id}")
        
        # Return most recent version
        return versions[-1]


# Global attempt manager instance
attempt_manager = AttemptManager()


# Example usage
if __name__ == "__main__":
    # Create session
    session_id = attempt_manager.create_session(
        submission_id="SUB-001",
        user_id="user-123",
        kb_version="v1.0.0"
    )
    
    # Initiate operation
    op_id, att_id = attempt_manager.initiate_operation(
        session_id=session_id,
        module="M1",
        operation="evaluate_section",
        input_data={"section": "Inclusion Criteria"},
        temperature=0.1,
        max_tokens=2000
    )
    
    # Mark processing
    attempt_manager.mark_processing(att_id)
    
    # Simulate JSON parse failure and retry
    new_att_id = attempt_manager.initiate_retry(
        original_attempt_id=att_id,
        error_message="JSON parse error",
        error_type="json_parse_error"
    )
    
    # Mark retry as completed
    attempt_manager.mark_completed(
        attempt_id=new_att_id,
        output_data={"findings": ["Finding 1", "Finding 2"]},
        actual_tokens=500,
        confidence_assessment={"overall_confidence": "HIGH"}
    )
    
    # Get operation history
    history = attempt_manager.get_operation_history(op_id)
    print(f"\nOperation History ({len(history)} attempts):")
    for attempt in history:
        print(f"  Attempt {attempt.attempt_number}: {attempt.status}")
    
    # Get final attempt
    final = attempt_manager.get_final_attempt(session_id, op_id)
    print(f"\nFinal Attempt: {final.attempt_id} (status: {final.status})")
