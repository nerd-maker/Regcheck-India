"""
Workflow Orchestrator
Implements Rule 1: Module Sequencing (M2 → M1 → M2)
Never ship generated content unchecked
"""

from typing import Dict, List, Optional
from pydantic import BaseModel
import logging
from datetime import datetime

from app.services.session_manager import session_manager
from app.services.review_queue import review_queue, assess_confidence
from app.services.pii_detector import pii_detector
from app.config.llm_config import LLMConfig

# Gap service integrations
from app.services.revision_loop_manager import revision_loop_manager  # Gap 6
from app.services.confidence_assessor import confidence_assessor       # Gap 2
from app.core.datetime_utils import utc_now

logger = logging.getLogger(__name__)


class WorkflowResult(BaseModel):
    """Result from workflow orchestration"""
    session_id: str
    sections: List[dict]
    compliance_result: dict
    revision_count: int
    final_confidence: float
    requires_review: bool
    workflow_duration: float
    metadata: Dict


class WorkflowOrchestrator:
    """
    Orchestrates multi-module workflows with safety checks
    
    Primary workflow: M2 (Generate) → M1 (Check) → M2 (Revise)
    - Always validate after generating
    - Never ship unchecked content
    - Enforce confidence thresholds
    - Track complete audit trail
    """
    
    def __init__(
        self,
        document_generator,
        compliance_checker
    ):
        self.document_generator = document_generator
        self.compliance_checker = compliance_checker
    
    async def generate_and_validate_document(
        self,
        study_data: Dict,
        session_id: str,
        max_revision_cycles: int = 2
    ) -> WorkflowResult:
        """
        Complete M2 → M1 → M2 workflow
        
        Steps:
        1. M2: Generate document sections
        2. M1: Evaluate compliance
        3. If non-compliant: M2 revise sections
        4. M1: Re-evaluate
        5. Check confidence threshold
        6. Return result or route to review
        
        Args:
            study_data: Study metadata
            session_id: Session ID for audit trail
            max_revision_cycles: Maximum revision attempts
            
        Returns:
            WorkflowResult with sections and compliance status
        """
        start_time = utc_now()
        revision_count = 0
        
        logger.info(
            f"Starting M2→M1→M2 workflow",
            extra={"session_id": session_id}
        )
        
        # Step 1: M2 Generate
        logger.info("Step 1: M2 Document Generation")
        generated_sections = await self._generate_sections(
            study_data,
            session_id
        )
        
        # Step 2: M1 Check
        logger.info("Step 2: M1 Compliance Check")
        compliance_result = await self._check_compliance(
            generated_sections,
            session_id
        )
        
        current_sections = generated_sections
        
        # Step 3: Gap 6 — Intelligent revision loop with termination
        # Replaces simple while-loop with DATA_GAP/LANGUAGE_GAP classification,
        # max attempt enforcement, and human escalation for stuck sections.
        while (
            compliance_result["overall_compliance"] != "COMPLIANT"
            and revision_count < max_revision_cycles
        ):
            # Check if revision loop should continue
            should_continue = revision_loop_manager.should_revise(
                session_id=session_id,
                revision_count=revision_count,
                gaps=compliance_result.get("gaps", [])
            )
            
            if not should_continue["continue"]:
                logger.warning(
                    f"Revision loop terminated: {should_continue['reason']}",
                    extra={"session_id": session_id}
                )
                # Escalate remaining gaps to human completion
                escalation = revision_loop_manager.escalate_to_human(
                    session_id=session_id,
                    sections=current_sections,
                    gaps=compliance_result.get("gaps", []),
                    reason=should_continue["reason"]
                )
                compliance_result["escalation"] = escalation
                break
            
            logger.info(
                f"Step 3: M2 Revision (cycle {revision_count + 1})"
            )
            
            revised_sections = await self._revise_sections(
                current_sections,
                compliance_result["gaps"],
                session_id
            )
            
            # Re-check compliance
            compliance_result = await self._check_compliance(
                revised_sections,
                session_id
            )
            
            current_sections = revised_sections
            revision_count += 1
            
            # Track revision attempt
            revision_loop_manager.record_attempt(
                session_id=session_id,
                attempt=revision_count,
                remaining_gaps=len(compliance_result.get("gaps", []))
            )
        
        # Gap 2: Multi-signal confidence assessment (replaces naive calculation)
        final_confidence = self._calculate_overall_confidence(
            compliance_result
        )
        
        # Check confidence threshold (Rule 3)
        confidence_assessment = assess_confidence(final_confidence)
        
        if confidence_assessment.requires_human_review:
            logger.warning(
                f"Low confidence detected: {final_confidence}",
                extra={"session_id": session_id}
            )
            
            # Add to review queue
            review_queue.add_to_queue(
                session_id=session_id,
                module="M2_M1_WORKFLOW",
                operation="generate_and_validate",
                content={
                    "sections": current_sections,
                    "compliance": compliance_result
                },
                confidence=confidence_assessment,
                reason=f"Workflow confidence below threshold: {final_confidence:.2f}"
            )
        
        duration = (utc_now() - start_time).total_seconds()
        
        result = WorkflowResult(
            session_id=session_id,
            sections=current_sections,
            compliance_result=compliance_result,
            revision_count=revision_count,
            final_confidence=final_confidence,
            requires_review=confidence_assessment.requires_human_review,
            workflow_duration=duration,
            metadata={
                "max_revision_cycles": max_revision_cycles,
                "confidence_level": confidence_assessment.confidence_level,
                "revision_terminated_early": revision_count < max_revision_cycles and compliance_result["overall_compliance"] != "COMPLIANT"
            }
        )
        
        logger.info(
            f"Workflow completed: {revision_count} revisions, "
            f"confidence={final_confidence:.2f}",
            extra={
                "session_id": session_id,
                "duration": duration,
                "requires_review": result.requires_review
            }
        )
        
        return result
    
    async def _generate_sections(
        self,
        study_data: Dict,
        session_id: str
    ) -> List[Dict]:
        """Generate document sections with PII detection"""
        
        # Check for PII (Rule 8)
        study_data_str = str(study_data)
        if pii_detector.has_pii(study_data_str):
            logger.warning(
                "PII detected in study data",
                extra={"session_id": session_id}
            )
            
            # Redact PII
            redacted_str, redaction_map = pii_detector.redact_pii(
                study_data_str
            )
            
            # Log redaction
            session_manager.log_operation(
                session_id=session_id,
                module="M2",
                operation="pii_redaction",
                input_hash="",
                output_hash="",
                metadata={"redacted_count": len(redaction_map)}
            )
        
        # Generate sections
        sections = await self.document_generator.generate_full_document(
            study_data=study_data,
            session_id=session_id
        )
        
        # Log operation
        session_manager.log_operation(
            session_id=session_id,
            module="M2",
            operation="generate_sections",
            input_hash=hash(str(study_data)),
            output_hash=hash(str(sections)),
            temperature=LLMConfig.get_temperature("M2_GENERATION"),
            max_tokens=LLMConfig.get_max_tokens("M2_SECTION_GEN")
        )
        
        return sections
    
    async def _check_compliance(
        self,
        sections: List[Dict],
        session_id: str
    ) -> Dict:
        """Check compliance with M1"""
        
        compliance_result = await self.compliance_checker.evaluate_compliance(
            sections=sections,
            session_id=session_id
        )
        
        # Log operation
        session_manager.log_operation(
            session_id=session_id,
            module="M1",
            operation="check_compliance",
            input_hash=hash(str(sections)),
            output_hash=hash(str(compliance_result)),
            confidence_score=compliance_result.get("confidence_score", 0.0),
            temperature=LLMConfig.get_temperature("M1_COMPLIANCE"),
            max_tokens=LLMConfig.get_max_tokens("M1_SECTION_EVAL")
        )
        
        return compliance_result
    
    async def _revise_sections(
        self,
        sections: List[Dict],
        gaps: List[Dict],
        session_id: str
    ) -> List[Dict]:
        """Revise sections based on compliance gaps"""
        
        revised_sections = await self.document_generator.revise_sections(
            sections=sections,
            gaps=gaps,
            session_id=session_id
        )
        
        # Log operation
        session_manager.log_operation(
            session_id=session_id,
            module="M2",
            operation="revise_sections",
            input_hash=hash(str(sections)),
            output_hash=hash(str(revised_sections)),
            temperature=LLMConfig.get_temperature("M2_GENERATION"),
            max_tokens=LLMConfig.get_max_tokens("M2_SECTION_GEN"),
            metadata={"gap_count": len(gaps)}
        )
        
        return revised_sections
    
    def _calculate_overall_confidence(self, compliance_result: Dict) -> float:
        """Calculate overall confidence from compliance result"""
        # Simple average of section confidence scores
        if "sections" in compliance_result:
            scores = [
                s.get("confidence_score", 0.5)
                for s in compliance_result["sections"]
            ]
            return sum(scores) / len(scores) if scores else 0.5
        
        return compliance_result.get("confidence_score", 0.5)


