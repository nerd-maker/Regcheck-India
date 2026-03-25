"""
Knowledge Base Version Manager
Implements Rule 4: Version locking and re-evaluation on KB updates
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict
import logging
from app.core.datetime_utils import utc_now

logger = logging.getLogger(__name__)


class KBVersion(BaseModel):
    """Knowledge base version metadata"""
    version: str
    created_at: datetime = Field(default_factory=utc_now)
    change_summary: str
    source_documents: List[str] = Field(default_factory=list)
    deprecated_at: Optional[datetime] = None


class RevalidationTask(BaseModel):
    """Task for re-evaluating submission with new KB version"""
    submission_id: str
    old_kb_version: str
    new_kb_version: str
    priority: str = "HIGH"  # HIGH, MEDIUM, LOW
    created_at: datetime = Field(default_factory=utc_now)
    status: str = "PENDING"  # PENDING, IN_PROGRESS, COMPLETED, FAILED


class KBVersionManager:
    """
    Manages knowledge base versions and triggers re-evaluation
    
    When CDSCO publishes new guidance:
    1. Update KB version
    2. Queue all pending submissions for re-evaluation
    3. Log version change in audit trail
    """
    
    def __init__(self):
        self.current_version = "v1.0.0"
        self.version_history: List[KBVersion] = []
        self.revalidation_queue: List[RevalidationTask] = []
        
        # Initialize with current version
        self.version_history.append(KBVersion(
            version=self.current_version,
            change_summary="Initial knowledge base version",
            source_documents=["NDCTR 2019", "Schedule Y", "ICH Guidelines"]
        ))
    
    def get_current_version(self) -> str:
        """Get current KB version"""
        return self.current_version
    
    def get_version_metadata(self, version: str) -> Optional[KBVersion]:
        """Get metadata for specific version"""
        for v in self.version_history:
            if v.version == version:
                return v
        return None
    
    def update_version(
        self,
        new_version: str,
        change_summary: str,
        source_documents: List[str]
    ) -> KBVersion:
        """
        Update KB to new version and trigger re-evaluation
        
        Args:
            new_version: New version identifier (e.g., "v1.1.0")
            change_summary: Summary of changes
            source_documents: List of new/updated source documents
            
        Returns:
            New KBVersion object
        """
        # Deprecate current version
        current = self.get_version_metadata(self.current_version)
        if current:
            current.deprecated_at = utc_now()
        
        # Create new version
        new_kb_version = KBVersion(
            version=new_version,
            change_summary=change_summary,
            source_documents=source_documents
        )
        
        self.version_history.append(new_kb_version)
        old_version = self.current_version
        self.current_version = new_version
        
        logger.info(
            f"KB version updated: {old_version} → {new_version}",
            extra={
                "old_version": old_version,
                "new_version": new_version,
                "change_summary": change_summary
            }
        )
        
        # Trigger re-evaluation of pending submissions
        self.trigger_revalidation(old_version, new_version)
        
        return new_kb_version
    
    def trigger_revalidation(self, old_version: str, new_version: str):
        """
        Queue pending submissions for re-evaluation
        
        Production: Query database for all pending submissions
        """
        # Mock: Get pending submissions
        # In production, query from database:
        # pending_submissions = db.query(Submission).filter(
        #     Submission.status.in_(["PENDING", "IN_REVIEW"]),
        #     Submission.kb_version == old_version
        # ).all()
        
        pending_submissions = self._get_pending_submissions(old_version)
        
        for submission_id in pending_submissions:
            task = RevalidationTask(
                submission_id=submission_id,
                old_kb_version=old_version,
                new_kb_version=new_version,
                priority="HIGH"
            )
            
            self.revalidation_queue.append(task)
            
            logger.info(
                f"Queued submission for revalidation: {submission_id}",
                extra={
                    "submission_id": submission_id,
                    "old_version": old_version,
                    "new_version": new_version
                }
            )
        
        logger.info(
            f"Queued {len(pending_submissions)} submissions for revalidation"
        )
    
    def _get_pending_submissions(self, kb_version: str) -> List[str]:
        """
        Get pending submissions using old KB version
        
        Production: Replace with database query
        """
        # Mock implementation
        return []
    
    def get_revalidation_queue(self) -> List[RevalidationTask]:
        """Get all pending revalidation tasks"""
        return [
            task for task in self.revalidation_queue
            if task.status == "PENDING"
        ]
    
    def mark_revalidation_complete(self, submission_id: str):
        """Mark revalidation task as completed"""
        for task in self.revalidation_queue:
            if task.submission_id == submission_id and task.status == "PENDING":
                task.status = "COMPLETED"
                logger.info(f"Revalidation completed: {submission_id}")
                break


# Global KB version manager instance
kb_version_manager = KBVersionManager()
