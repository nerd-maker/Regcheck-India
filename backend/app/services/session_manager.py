"""
Session Management for Audit Trail
Implements Rule 2: Shared Session ID across all modules
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Dict, List, Optional
import uuid
import logging
from app.core.datetime_utils import utc_now

logger = logging.getLogger(__name__)


class SessionContext(BaseModel):
    """Session context for a single submission workflow"""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    submission_id: str
    user_id: str
    created_at: datetime = Field(default_factory=utc_now)
    kb_version: str  # Rule 4: Version locking
    metadata: Dict = Field(default_factory=dict)


class AuditLogEntry(BaseModel):
    """Single audit log entry for tracking operations"""
    session_id: str
    module: str  # M1, M2, M3, M4
    operation: str
    timestamp: datetime = Field(default_factory=utc_now)
    input_hash: str
    output_hash: str
    confidence_score: Optional[float] = None
    kb_version: str
    temperature: float
    max_tokens: int
    actual_tokens: Optional[int] = None
    metadata: Dict = Field(default_factory=dict)


class SessionManager:
    """
    Manages sessions and audit logs for complete audit trail reconstruction
    
    Production Note: Replace in-memory storage with Redis/PostgreSQL
    """
    
    def __init__(self):
        self.sessions: Dict[str, SessionContext] = {}
        self.audit_log: List[AuditLogEntry] = []
        self.kb_version = "v1.0.0"  # Should be loaded from KB version manager
    
    def create_session(
        self,
        submission_id: str,
        user_id: str,
        metadata: Optional[Dict] = None
    ) -> str:
        """Create new session and return session_id"""
        session = SessionContext(
            submission_id=submission_id,
            user_id=user_id,
            kb_version=self.kb_version,
            metadata=metadata or {}
        )
        
        self.sessions[session.session_id] = session
        
        logger.info(
            f"Created session {session.session_id} for submission {submission_id}",
            extra={"session_id": session.session_id, "user_id": user_id}
        )
        
        return session.session_id
    
    def get_session(self, session_id: str) -> Optional[SessionContext]:
        """Retrieve session context"""
        return self.sessions.get(session_id)
    
    def log_operation(
        self,
        session_id: str,
        module: str,
        operation: str,
        input_hash: str,
        output_hash: str,
        confidence_score: Optional[float] = None,
        temperature: float = 0.0,
        max_tokens: int = 0,
        actual_tokens: Optional[int] = None,
        metadata: Optional[Dict] = None
    ):
        """Log operation for audit trail"""
        session = self.get_session(session_id)
        if not session:
            logger.warning(f"Session not found: {session_id}")
            return
        
        entry = AuditLogEntry(
            session_id=session_id,
            module=module,
            operation=operation,
            input_hash=input_hash,
            output_hash=output_hash,
            confidence_score=confidence_score,
            kb_version=session.kb_version,
            temperature=temperature,
            max_tokens=max_tokens,
            actual_tokens=actual_tokens,
            metadata=metadata or {}
        )
        
        self.audit_log.append(entry)
        
        logger.info(
            f"Logged operation: {module}.{operation}",
            extra={
                "session_id": session_id,
                "module": module,
                "operation": operation,
                "confidence": confidence_score
            }
        )
    
    def get_session_audit_trail(self, session_id: str) -> List[AuditLogEntry]:
        """Retrieve complete audit trail for a session"""
        return [
            entry for entry in self.audit_log
            if entry.session_id == session_id
        ]
    
    def get_submission_sessions(self, submission_id: str) -> List[SessionContext]:
        """Get all sessions for a submission"""
        return [
            session for session in self.sessions.values()
            if session.submission_id == submission_id
        ]


# Global session manager instance
session_manager = SessionManager()
