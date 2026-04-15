"""
Submission Impact Assessor Service

Assesses the impact of regulatory changes on active pharmaceutical submissions.
"""

import json
import logging
from typing import List, Dict, Any
import anthropic
from app.services.claude_client import call_claude, MODEL_SONNET

from app.core.config import settings
from app.models.regulatory_change_schemas import (
    RegulatoryChange,
    SubmissionImpactAssessment,
    ActiveSubmission,
    ImpactAssessmentRequest
)
from app.prompts.regulatory_intelligence_prompts import (
    SYSTEM_PROMPT,
    IMPACT_ASSESSMENT_PROMPT,
    format_change_for_prompt,
    format_submission_for_prompt
)

logger = logging.getLogger(__name__)
OpenAI = anthropic.Anthropic


class SubmissionImpactAssessor:
    """
    Assesses impact of regulatory changes on active submissions.
    
    Uses Claude API to:
    1. Evaluate change relevance to submission
    2. Identify affected documents
    3. Generate action items
    4. Create alerts for RA teams
    """
    
    def __init__(self):
        """Initialize the assessor with Claude API client"""
        pass
    
    
    def assess_impact(
        self,
        change: RegulatoryChange,
        submission: ActiveSubmission,
        submission_content: str = ""
    ) -> SubmissionImpactAssessment:
        """
        Assess impact of a regulatory change on a specific submission.
        
        Args:
            change: RegulatoryChange object
            submission: ActiveSubmission object
            submission_content: Relevant content from submission documents
        
        Returns:
            SubmissionImpactAssessment object
        """
        # Format the impact assessment prompt
        prompt = IMPACT_ASSESSMENT_PROMPT.format(
            change_id=change.change_id,
            domain=change.domain,
            change_type=change.change_type,
            new_requirement=change.new_requirement,
            effective_date=change.effective_date,
            affected_submission_types=", ".join(change.affected_submission_types),
            urgency=change.urgency,
            full_change_json=change.model_dump_json(indent=2),
            submission_id=submission.submission_id,
            submission_type=submission.submission_type,
            drug_name=submission.drug_name,
            phase=submission.phase or "N/A",
            status=submission.status,
            current_stage=submission.current_stage,
            key_documents=", ".join(submission.key_documents),
            submission_content=submission_content or "No submission content available for comparison."
        )
        
        # Call Claude API
        result = call_claude(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            model=MODEL_SONNET,
            max_tokens=4000,
            temperature=0.0,
        )
        
        # Parse response
        response_text = result["content"]
        
        # Extract JSON from response
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            json_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            json_text = response_text[json_start:json_end].strip()
        else:
            json_text = response_text.strip()
        
        # Parse JSON response
        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Claude response as JSON: {e}\nResponse: {response_text}")
        
        # Create SubmissionImpactAssessment object
        return SubmissionImpactAssessment(**parsed)
    
    
    def retrieve_submission_content(
        self,
        submission: ActiveSubmission,
        change_domain: str,
        knowledge_base=None
    ) -> str:
        """
        Retrieve relevant submission content for impact assessment.
        
        Args:
            submission: ActiveSubmission object
            change_domain: Regulatory domain of the change
            knowledge_base: Optional KnowledgeBase instance from Module 01
        
        Returns:
            Relevant submission content as string
        """
        if knowledge_base is None:
            return "No knowledge base available for content retrieval."
        
        # Query knowledge base for submission content related to change domain
        try:
            results = knowledge_base.query(
                query_text=f"{change_domain} requirements for {submission.drug_name}",
                filter={"submission_id": submission.submission_id},
                n_results=5
            )
            
            if results and len(results) > 0:
                # Combine retrieved content
                content_parts = []
                for result in results:
                    content_parts.append(f"Section: {result.get('section', 'Unknown')}\n{result.get('content', '')}")
                return "\n\n".join(content_parts)
            else:
                return f"No submission content found for {submission.submission_id} related to {change_domain}."
        
        except Exception as e:
            return f"Error retrieving submission content: {str(e)}"
    
    
    def identify_affected_documents(
        self,
        impact: SubmissionImpactAssessment
    ) -> List[str]:
        """
        Identify documents requiring changes.
        
        Args:
            impact: SubmissionImpactAssessment object
        
        Returns:
            List of affected document names
        """
        return [doc.document for doc in impact.affected_documents]
    
    
    def generate_action_items(
        self,
        impact: SubmissionImpactAssessment
    ) -> List[Dict[str, Any]]:
        """
        Generate actionable recommendations.
        
        Args:
            impact: SubmissionImpactAssessment object
        
        Returns:
            List of action item dictionaries
        """
        return [action.model_dump() for action in impact.recommended_actions]
    
    
    def create_alert(
        self,
        impact: SubmissionImpactAssessment,
        change: RegulatoryChange
    ) -> str:
        """
        Create plain language alert for RA team.
        
        Args:
            impact: SubmissionImpactAssessment object
            change: RegulatoryChange object
        
        Returns:
            Alert text
        """
        alert_header = f"REGULATORY ALERT: {change.domain} - {change.urgency} URGENCY\n"
        alert_header += f"Change ID: {change.change_id}\n"
        alert_header += f"Submission: {impact.submission_id}\n"
        alert_header += f"Impact Status: {impact.impact_status}\n\n"
        
        return alert_header + impact.alert_text
    
    
    def assess_multiple_submissions(
        self,
        change: RegulatoryChange,
        submissions: List[ActiveSubmission],
        knowledge_base=None
    ) -> List[SubmissionImpactAssessment]:
        """
        Assess impact of a change on multiple submissions.
        
        Args:
            change: RegulatoryChange object
            submissions: List of ActiveSubmission objects
            knowledge_base: Optional KnowledgeBase instance
        
        Returns:
            List of SubmissionImpactAssessment objects
        """
        assessments = []
        
        for submission in submissions:
            # Filter by submission type
            if submission.submission_type not in change.affected_submission_types:
                # Create NOT_IMPACTED assessment
                assessment = SubmissionImpactAssessment(
                    submission_id=submission.submission_id,
                    change_id=change.change_id,
                    impact_status="NOT_IMPACTED",
                    impact_rationale=f"Submission type {submission.submission_type} not affected by this change.",
                    estimated_delay_risk="0 days",
                    human_review_required=False,
                    alert_text=f"No action required for {submission.submission_id}."
                )
                assessments.append(assessment)
                continue
            
            # Retrieve submission content
            submission_content = self.retrieve_submission_content(
                submission, change.domain, knowledge_base
            )
            
            # Assess impact
            try:
                assessment = self.assess_impact(change, submission, submission_content)
                assessments.append(assessment)
            except Exception as e:
                # Create error assessment
                assessment = SubmissionImpactAssessment(
                    submission_id=submission.submission_id,
                    change_id=change.change_id,
                    impact_status="MONITOR",
                    impact_rationale=f"Error during assessment: {str(e)}",
                    estimated_delay_risk="Unknown",
                    human_review_required=True,
                    alert_text=f"Manual review required for {submission.submission_id} due to assessment error."
                )
                assessments.append(assessment)
        
        return assessments
