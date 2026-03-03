"""
Regulatory Change Store

In-memory store for regulatory changes and impact assessments.
Production: Replace with PostgreSQL or MongoDB.
"""

from typing import List, Dict, Optional
from datetime import datetime

from app.models.regulatory_change_schemas import (
    RegulatoryChange,
    SubmissionImpactAssessment,
    ActiveSubmission
)


class RegulatoryChangeStore:
    """
    In-memory store for regulatory changes and submissions.
    
    NOTE: This is a simple in-memory implementation for development.
    Production should use a proper database (PostgreSQL, MongoDB, etc.)
    """
    
    def __init__(self):
        """Initialize empty stores"""
        self.changes: Dict[str, RegulatoryChange] = {}
        self.impact_assessments: Dict[str, List[SubmissionImpactAssessment]] = {}
        self.submissions: Dict[str, ActiveSubmission] = {}
    
    
    # =============================================================================
    # CHANGE OPERATIONS
    # =============================================================================
    
    def save_change(self, change: RegulatoryChange) -> None:
        """
        Save a regulatory change.
        
        Args:
            change: RegulatoryChange object
        """
        self.changes[change.change_id] = change
    
    
    def get_change(self, change_id: str) -> Optional[RegulatoryChange]:
        """
        Retrieve a change by ID.
        
        Args:
            change_id: Change ID
        
        Returns:
            RegulatoryChange object or None
        """
        return self.changes.get(change_id)
    
    
    def list_changes(
        self,
        domain: Optional[str] = None,
        urgency: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100
    ) -> List[RegulatoryChange]:
        """
        List changes with optional filters.
        
        Args:
            domain: Filter by regulatory domain
            urgency: Filter by urgency level
            start_date: Filter by detected date (YYYY-MM-DD)
            end_date: Filter by detected date (YYYY-MM-DD)
            limit: Maximum number of results
        
        Returns:
            List of RegulatoryChange objects
        """
        results = list(self.changes.values())
        
        # Apply filters
        if domain:
            results = [c for c in results if c.domain == domain]
        
        if urgency:
            results = [c for c in results if c.urgency == urgency]
        
        if start_date:
            start_dt = datetime.fromisoformat(start_date)
            results = [c for c in results if c.detected_date >= start_dt]
        
        if end_date:
            end_dt = datetime.fromisoformat(end_date)
            results = [c for c in results if c.detected_date <= end_dt]
        
        # Sort by detected date (newest first)
        results.sort(key=lambda c: c.detected_date, reverse=True)
        
        # Apply limit
        return results[:limit]
    
    
    def get_changes_by_date_range(
        self,
        start_date: str,
        end_date: str
    ) -> List[RegulatoryChange]:
        """
        Get all changes within a date range.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            List of RegulatoryChange objects
        """
        return self.list_changes(start_date=start_date, end_date=end_date, limit=1000)
    
    
    def delete_change(self, change_id: str) -> bool:
        """
        Delete a change.
        
        Args:
            change_id: Change ID
        
        Returns:
            True if deleted, False if not found
        """
        if change_id in self.changes:
            del self.changes[change_id]
            return True
        return False
    
    
    # =============================================================================
    # IMPACT ASSESSMENT OPERATIONS
    # =============================================================================
    
    def save_impact_assessment(self, assessment: SubmissionImpactAssessment) -> None:
        """
        Save an impact assessment.
        
        Args:
            assessment: SubmissionImpactAssessment object
        """
        key = f"{assessment.change_id}:{assessment.submission_id}"
        
        if assessment.change_id not in self.impact_assessments:
            self.impact_assessments[assessment.change_id] = []
        
        # Remove existing assessment for same submission if exists
        self.impact_assessments[assessment.change_id] = [
            ia for ia in self.impact_assessments[assessment.change_id]
            if ia.submission_id != assessment.submission_id
        ]
        
        # Add new assessment
        self.impact_assessments[assessment.change_id].append(assessment)
    
    
    def get_impact_assessment(
        self,
        change_id: str,
        submission_id: str
    ) -> Optional[SubmissionImpactAssessment]:
        """
        Get impact assessment for specific change and submission.
        
        Args:
            change_id: Change ID
            submission_id: Submission ID
        
        Returns:
            SubmissionImpactAssessment object or None
        """
        if change_id not in self.impact_assessments:
            return None
        
        for assessment in self.impact_assessments[change_id]:
            if assessment.submission_id == submission_id:
                return assessment
        
        return None
    
    
    def get_impacted_submissions(
        self,
        change_id: str,
        impact_status: Optional[str] = None
    ) -> List[SubmissionImpactAssessment]:
        """
        Get all submissions impacted by a change.
        
        Args:
            change_id: Change ID
            impact_status: Optional filter by impact status
        
        Returns:
            List of SubmissionImpactAssessment objects
        """
        if change_id not in self.impact_assessments:
            return []
        
        assessments = self.impact_assessments[change_id]
        
        if impact_status:
            assessments = [a for a in assessments if a.impact_status == impact_status]
        
        return assessments
    
    
    def get_all_impact_assessments(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[SubmissionImpactAssessment]:
        """
        Get all impact assessments, optionally filtered by date.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
        
        Returns:
            List of SubmissionImpactAssessment objects
        """
        all_assessments = []
        for assessments in self.impact_assessments.values():
            all_assessments.extend(assessments)
        
        # Apply date filters if provided
        if start_date:
            start_dt = datetime.fromisoformat(start_date)
            all_assessments = [a for a in all_assessments if a.assessment_date >= start_dt]
        
        if end_date:
            end_dt = datetime.fromisoformat(end_date)
            all_assessments = [a for a in all_assessments if a.assessment_date <= end_dt]
        
        return all_assessments
    
    
    # =============================================================================
    # SUBMISSION OPERATIONS
    # =============================================================================
    
    def save_submission(self, submission: ActiveSubmission) -> None:
        """
        Save an active submission.
        
        Args:
            submission: ActiveSubmission object
        """
        self.submissions[submission.submission_id] = submission
    
    
    def get_submission(self, submission_id: str) -> Optional[ActiveSubmission]:
        """
        Get a submission by ID.
        
        Args:
            submission_id: Submission ID
        
        Returns:
            ActiveSubmission object or None
        """
        return self.submissions.get(submission_id)
    
    
    def list_submissions(
        self,
        submission_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[ActiveSubmission]:
        """
        List active submissions with optional filters.
        
        Args:
            submission_type: Filter by submission type
            status: Filter by status
            limit: Maximum number of results
        
        Returns:
            List of ActiveSubmission objects
        """
        results = list(self.submissions.values())
        
        if submission_type:
            results = [s for s in results if s.submission_type == submission_type]
        
        if status:
            results = [s for s in results if s.status == status]
        
        # Sort by submission date (newest first)
        results.sort(key=lambda s: s.submission_date or datetime.min, reverse=True)
        
        return results[:limit]
    
    
    def delete_submission(self, submission_id: str) -> bool:
        """
        Delete a submission.
        
        Args:
            submission_id: Submission ID
        
        Returns:
            True if deleted, False if not found
        """
        if submission_id in self.submissions:
            del self.submissions[submission_id]
            return True
        return False
    
    
    # =============================================================================
    # UTILITY OPERATIONS
    # =============================================================================
    
    def get_stats(self) -> Dict[str, int]:
        """
        Get store statistics.
        
        Returns:
            Dictionary with counts
        """
        total_assessments = sum(len(assessments) for assessments in self.impact_assessments.values())
        
        return {
            "total_changes": len(self.changes),
            "total_submissions": len(self.submissions),
            "total_impact_assessments": total_assessments,
            "critical_changes": len([c for c in self.changes.values() if c.urgency == "CRITICAL"]),
            "high_urgency_changes": len([c for c in self.changes.values() if c.urgency == "HIGH"])
        }
    
    
    def clear_all(self) -> None:
        """Clear all data (use with caution!)"""
        self.changes.clear()
        self.impact_assessments.clear()
        self.submissions.clear()


# Global instance for use across the application
regulatory_change_store = RegulatoryChangeStore()
