"""
Claude-powered compliance evaluator for pharmaceutical documents.
"""
import json
from typing import Dict, Optional
from openai import OpenAI
import logging
import hashlib

from app.core.config import settings
from app.models.schemas import DocumentMetadata, EvaluationResponse
from app.services.rag_pipeline import rag_pipeline

# Production safety imports
from app.config.llm_config import LLMConfig
from app.services.session_manager import session_manager
from app.services.review_queue import review_queue, assess_confidence

# Gap service integrations
from app.services.confidence_assessor import confidence_assessor       # Gap 2
from app.services.output_determinism import output_determinism         # Gap 9
from app.services.prompt_version_manager import prompt_version_manager # Gap 8

logger = logging.getLogger(__name__)


class ComplianceEvaluator:
    """Evaluate pharmaceutical documents using Claude AI."""
    
    def __init__(self):
        """Initialize OpenAI-compatible client with production safety config."""
        self.client = OpenAI(
            api_key=settings.llm_api_key or "placeholder",
            base_url=settings.llm_base_url
        )
    
    def evaluate_document(
        self,
        parsed_document: Dict,
        metadata: DocumentMetadata,
        session_id: Optional[str] = None
    ) -> EvaluationResponse:
        """
        Evaluate a document for regulatory compliance.
        
        Production Safety:
        - Uses LLM config for deterministic temperature (0.1)
        - Enforces token budget (2000)
        - Logs to session audit trail
        - Checks confidence threshold
        - Routes low confidence to review queue
        
        Args:
            parsed_document: Parsed document from document_parser
            metadata: Document metadata
            session_id: Optional session ID for audit trail
            
        Returns:
            EvaluationResponse with compliance findings
        """
        # Retrieve relevant regulatory context
        rag_context = rag_pipeline.retrieve_context(
            document_type=metadata.document_type,
            document_content=parsed_document['full_text'],
            sections=parsed_document['sections'],
            metadata=metadata.model_dump()
        )
        
        # Build prompts
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(
            parsed_document=parsed_document,
            metadata=metadata,
            rag_context=rag_context
        )
        
        # Rule 5: Use deterministic temperature for compliance
        # Rule 6: Use configured token budget
        temperature = LLMConfig.get_temperature("M1_COMPLIANCE")
        max_tokens = LLMConfig.get_max_tokens("M1_SECTION_EVAL")
        
        # Call LLM API with production safety settings
        response = self.client.chat.completions.create(
            model=LLMConfig.LLM_MODEL,
            temperature=temperature,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )
        
        # Parse response
        response_text = response.choices[0].message.content
        
        # Gap 9: Check output cache first (before expensive parsing)
        input_hash = hashlib.sha256(user_prompt.encode()).hexdigest()[:16]
        output_hash = hashlib.sha256(response_text.encode()).hexdigest()[:16]
        cached = output_determinism.get_cached_output(input_hash)
        if cached:
            logger.info("Output cache hit for M1 evaluation", extra={"input_hash": input_hash})
        
        # Extract JSON from response
        try:
            evaluation_json = self._extract_json(response_text)
        except Exception as e:
            logger.error(f"Failed to extract JSON from compliance evaluation: {e}")
            # Route to review queue
            if session_id:
                review_queue.add_to_queue(
                    session_id=session_id,
                    module="M1",
                    operation="evaluate_document",
                    content={"response_text": response_text[:500]},
                    confidence=assess_confidence(0.0),
                    reason=f"JSON parsing failed: {str(e)}"
                )
            raise
        
        # Create response
        evaluation_response = EvaluationResponse(**evaluation_json)
        
        # Gap 2: Multi-signal confidence assessment (replaces naive LLM self-assessment)
        findings = evaluation_json.get("findings", [])
        citations_found = sum(1 for f in findings if f.get("citation") and "NOT FOUND" not in f.get("citation", ""))
        total_findings = len(findings)
        citation_ratio = citations_found / total_findings if total_findings > 0 else 0.0
        
        multi_signal_confidence = confidence_assessor.assess(
            retrieval_score=rag_context.get("avg_similarity", 0.5),
            citation_ratio=citation_ratio,
            schema_valid=True,  # JSON parsed successfully
            llm_self_assessment=evaluation_json.get("confidence_level", "MEDIUM")
        )
        confidence_numeric = multi_signal_confidence["overall_score"]
        confidence_assessment = assess_confidence(confidence_numeric)
        
        # Gap 8: Record prompt version for audit trail
        prompt_version = prompt_version_manager.get_active_version("M1_COMPLIANCE")
        
        # Rule 2: Log to audit trail (enhanced with gap integrations)
        if session_id:
            session_manager.log_operation(
                session_id=session_id,
                module="M1",
                operation="evaluate_document",
                input_hash=input_hash,
                output_hash=output_hash,
                confidence_score=confidence_numeric,
                temperature=temperature,
                max_tokens=max_tokens,
                actual_tokens=response.usage.output_tokens,
                metadata={
                    "document_type": metadata.document_type,
                    "overall_status": evaluation_json.get("overall_status"),
                    "total_findings": evaluation_json.get("total_findings"),
                    "prompt_version": prompt_version.get("version", "1.0.0") if prompt_version else "1.0.0",
                    "confidence_signals": multi_signal_confidence.get("signals", {}),
                }
            )
            
            # Gap 9: Store output for determinism
            output_determinism.store_output(
                input_hash=input_hash,
                output=evaluation_json,
                module="M1",
                session_id=session_id
            )
            
            # Add to review queue if low confidence
            if confidence_assessment.requires_human_review:
                review_queue.add_to_queue(
                    session_id=session_id,
                    module="M1",
                    operation="evaluate_document",
                    content=evaluation_json,
                    confidence=confidence_assessment,
                    reason=f"Multi-signal confidence below threshold: {confidence_numeric:.2f}"
                )
                logger.warning(
                    f"Low confidence evaluation added to review queue",
                    extra={"session_id": session_id, "confidence": confidence_numeric}
                )
        
        return evaluation_response
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for Claude."""
        return """You are RegCheck-India, a specialized regulatory compliance AI built exclusively
for analyzing pharmaceutical and clinical trial documents against Indian regulatory
requirements. You have deep expertise in:

  - New Drugs and Clinical Trials Rules (NDCTR) 2019 and 2024 amendments
  - CDSCO Guidelines for Bioavailability and Bioequivalence Studies
  - CTRI (Clinical Trials Registry of India) registration requirements
  - ICH E6(R3) Good Clinical Practice guidelines as adopted by India
  - Schedule Y requirements under Drugs and Cosmetics Act
  - Ethics Committee guidelines per Central Ethics Committee on Human Research

YOUR ABSOLUTE RULES — NEVER VIOLATE THESE:

1. CITATION MANDATORY: Every compliance finding MUST cite the exact regulatory
   source in this format: [SOURCE: NDCTR 2019, Rule 22(b)] or [SOURCE: ICH E6(R3),
   Section 4.8.2]. If you cannot find a specific citation, write [SOURCE: NOT FOUND
   IN RETRIEVED CONTEXT — FLAG FOR HUMAN REVIEW] and mark the finding as
   UNVERIFIED. Never state a regulatory requirement without a source.

2. NO FABRICATION: Do not invent regulatory requirements that are not in the
   retrieved context provided to you. If the retrieved context does not address
   a topic, say so explicitly. Do not fill gaps with general pharmaceutical
   knowledge unless clearly labelled as [GENERAL GUIDANCE — NOT INDIA-SPECIFIC].

3. BINARY COMPLIANCE STATUS: Every finding must be labelled as one of:
   PASS | PARTIAL | FAIL | NOT APPLICABLE | UNVERIFIED
   Do not use qualitative language like "appears adequate" without assigning
   one of these five statuses.

4. HUMAN REVIEW FLAGS: Whenever a finding requires legal interpretation, involves
   a known gray area in CDSCO practice, or where the retrieved context is
   ambiguous, add human_review_required: true to that finding.

5. NO APPROVAL GUARANTEE: Never state or imply that a document will be approved
   by CDSCO if it passes your check. Your output is a quality assurance tool,
   not a regulatory authority decision.

6. SCOPE DISCIPLINE: Only evaluate what the user has explicitly submitted.
   Do not comment on sections not present in the document unless their absence
   itself is a compliance gap.

You MUST respond with ONLY valid JSON matching the exact schema provided. No markdown, no prose."""
    
    def _build_user_prompt(
        self,
        parsed_document: Dict,
        metadata: DocumentMetadata,
        rag_context: Dict
    ) -> str:
        """Build the user prompt with document and context."""
        # Format sections
        sections_text = []
        for i, (heading, content) in enumerate(parsed_document['sections'], 1):
            # Limit content length for each section
            content_preview = content[:1000] + "..." if len(content) > 1000 else content
            sections_text.append(f"\nSection {i} — {heading}:\n{content_preview}")
        
        # Build regulatory context
        regulatory_context = rag_pipeline.build_claude_context(
            rag_context['retrieved_chunks']
        )
        
        prompt = f"""{regulatory_context}

=== DOCUMENT METADATA ===
Document Type: {metadata.document_type}
Sponsor Name: {metadata.sponsor_name}
Molecule/Drug: {metadata.drug_name} | INN: {metadata.inn or 'Not specified'}
Phase: {metadata.trial_phase}
Submission Target: {metadata.submission_target}
Document Version: {metadata.version or 'Not specified'} | Date: {metadata.date or 'Not specified'}

=== DOCUMENT CONTENT ===
{''.join(sections_text)}

=== TASK ===
Evaluate the document described above against ALL applicable Indian regulatory
requirements present in the retrieved context.

Produce your output in the following EXACT JSON structure — no prose, no markdown,
only valid JSON that can be parsed programmatically:

{{
  "evaluation_id": "auto-generated-uuid",
  "document_type": "{metadata.document_type}",
  "overall_status": "PASS | PARTIAL | FAIL",
  "overall_risk": "HIGH | MEDIUM | LOW",
  "total_findings": <number>,
  "findings_by_status": {{
    "FAIL": <number>,
    "PARTIAL": <number>,
    "PASS": <number>,
    "UNVERIFIED": <number>
  }},
  "findings": [
    {{
      "finding_id": "F001",
      "section": "Section heading from document",
      "requirement": "Plain-language statement of what is required",
      "citation": "[SOURCE: exact rule/section reference]",
      "current_text": "Verbatim quote from document (max 100 words)",
      "status": "PASS | PARTIAL | FAIL | NOT APPLICABLE | UNVERIFIED",
      "gap": "Specific description of what is missing or incorrect — null if PASS",
      "recommended_language": "Suggested replacement text — null if PASS",
      "human_review_required": true | false,
      "human_review_reason": "Why human review is needed — null if false"
    }}
  ],
  "critical_blockers": ["List of FAIL findings that will prevent CDSCO acceptance"],
  "missing_sections": ["Mandatory sections entirely absent from document"],
  "evaluator_notes": "Any systemic observations about document quality",
  "confidence_level": "HIGH | MEDIUM | LOW",
  "confidence_rationale": "Why confidence is at this level"
}}

CRITICAL: If the retrieved context does not contain enough information to evaluate
a specific requirement, set status to UNVERIFIED and set human_review_required to
true. Do not guess. Do not fill gaps.

Respond with ONLY the JSON object, nothing else."""
        
        return prompt
    
    def _extract_json(self, response_text: str) -> Dict:
        """Extract JSON from Claude's response."""
        # Try to find JSON in the response
        try:
            # First, try to parse the entire response as JSON
            return json.loads(response_text)
        except json.JSONDecodeError:
            # If that fails, try to find JSON between ```json and ```
            import re
            json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))
            
            # If still no luck, try to find any JSON object
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            
            # If all fails, raise error
            raise ValueError(f"Could not extract valid JSON from response: {response_text[:500]}")


# Global evaluator instance
compliance_evaluator = ComplianceEvaluator()
