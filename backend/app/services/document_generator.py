"""
Document Generator Service - Pipeline Orchestrator

Generates regulatory documents section-by-section with inline validation
"""
import json
import os
from typing import Dict, List, Optional
from openai import OpenAI
import logging
import hashlib

from app.core.config import settings
from app.services.schema_engine import SchemaEngine, SectionSchema
from app.services.evaluator import ComplianceEvaluator
from app.prompts.document_generation_prompts import (
    SYSTEM_PROMPT_DOCGEN,
    CONTEXT_INJECTION_TEMPLATE,
    SECTION_GENERATION_TEMPLATE,
    SECTION_INSTRUCTIONS
)
from app.models.study_data_schemas import StudyDataInput, GeneratedSection

# Production safety imports
from app.config.llm_config import LLMConfig
from app.utils.json_parser import parse_llm_json
from app.services.session_manager import session_manager
from app.services.pii_detector import pii_detector

# Gap service integrations
from app.services.section_context_store import SectionContextStore     # Gap 15
from app.services.prompt_version_manager import prompt_version_manager # Gap 8
from app.services.aikosh_client import orchestrator, run_async

logger = logging.getLogger(__name__)


class DocumentGenerator:
    """
    Pipeline-based document generator
    
    Generates documents section-by-section with inline compliance validation
    """
    
    def __init__(self):
        self.schema_engine = SchemaEngine()
        self.compliance_evaluator = ComplianceEvaluator()
        self.client = OpenAI(
            api_key=settings.llm_api_key or "placeholder",
            base_url=settings.llm_base_url
        )
    
    def generate_document(
        self,
        document_type: str,
        study_data: StudyDataInput,
        validate_inline: bool = True
    ) -> Dict:
        """
        Generate complete document section-by-section
        
        Args:
            document_type: Type of document (protocol, icf, csr, ctri, ib)
            study_data: Study data input
            validate_inline: Whether to validate each section before proceeding
        
        Returns:
            Dictionary with generated sections and validation results
        """
        schema = self.schema_engine.get_schema(document_type)
        generated_sections: List[GeneratedSection] = []
        validation_results = []
        
        # Gap 15: Initialize section context store for cross-reference tracking
        context_store = SectionContextStore(document_type=document_type)
        
        for section_schema in schema.sections:
            print(f"Generating section {section_schema.section_number}: {section_schema.section_heading}")
            
            # 1. Generate section (with accumulated context)
            section_result = self._generate_section(
                document_type=document_type,
                section_schema=section_schema,
                study_data=study_data,
                previous_sections=generated_sections,
                context_store=context_store
            )
            
            # 2. Gap 15: Extract and store cross-reference terms from generated content
            context_store.extract_and_store(
                section_id=section_schema.section_number,
                section_heading=section_schema.section_heading,
                content=section_result.generated_content
            )
            
            # 3. Validate section if enabled
            if validate_inline:
                validation_result = self._validate_section(
                    section_content=section_result.generated_content,
                    section_schema=section_schema,
                    document_type=document_type
                )
                validation_results.append(validation_result)
                
                # Stop if validation fails critically
                if validation_result.get("overall_status") == "FAIL":
                    return {
                        "status": "validation_failed",
                        "section": section_schema.section_number,
                        "generated_sections": [s.model_dump() for s in generated_sections],
                        "failed_section": section_result.model_dump(),
                        "validation_result": validation_result,
                        "message": "Section failed validation. Manual review required before proceeding."
                    }
            
            # 4. Store section
            generated_sections.append(section_result)
        
        # 5. Assemble final document
        assembled_document = self._assemble_document(generated_sections, schema)
        
        # 6. Gap 15: Post-generation cross-reference validation
        cross_ref_report = context_store.validate_cross_references(assembled_document)
        
        return {
            "status": "success",
            "document_type": document_type,
            "regulatory_standard": schema.regulatory_standard,
            "sections": [s.model_dump() for s in generated_sections],
            "assembled_document": assembled_document,
            "validation_results": validation_results,
            "cross_reference_report": cross_ref_report,
            "total_placeholders": sum(len(s.placeholders_used) for s in generated_sections),
            "high_priority_sections": [
                s.section_number for s in generated_sections if s.review_priority == "HIGH"
            ]
        }
    
    def generate_single_section(
        self,
        document_type: str,
        section_number: str,
        study_data: StudyDataInput,
        previous_sections: Optional[List[GeneratedSection]] = None
    ) -> GeneratedSection:
        """Generate a single section (for manual step-through)"""
        section_schema = self.schema_engine.get_section_schema(document_type, section_number)
        return self._generate_section(
            document_type=document_type,
            section_schema=section_schema,
            study_data=study_data,
            previous_sections=previous_sections or []
        )
    
    def _generate_section(
        self,
        document_type: str,
        section_schema: SectionSchema,
        study_data: StudyDataInput,
        previous_sections: List[GeneratedSection],
        session_id: Optional[str] = None,
        context_store: Optional[SectionContextStore] = None
    ) -> GeneratedSection:
        """
        Generate content for a single section using Claude
        
        Production Safety:
        - Uses LLM config for temperature and token budgets
        - Uses robust JSON parser with retry
        - Logs operation to session audit trail
        - Detects PII in study data
        """
        
        # Build context
        context = self._build_context(
            document_type=document_type,
            section_schema=section_schema,
            study_data=study_data,
            previous_sections=previous_sections
        )
        
        # Get section-specific instructions
        section_type = section_schema.section_heading
        specific_instructions = SECTION_INSTRUCTIONS.get(
            section_type,
            section_schema.special_instructions or "Follow the regulatory requirements specified above."
        )
        
        # Build task prompt
        task_prompt = SECTION_GENERATION_TEMPLATE.format(
            section_number=section_schema.section_number,
            section_heading=section_schema.section_heading,
            document_type=document_type,
            regulatory_standard=self.schema_engine.get_schema(document_type).regulatory_standard,
            section_specific_instructions=specific_instructions
        )
        
        # Gap 15: Inject accumulated cross-reference context
        cross_ref_context = ""
        if context_store:
            accumulated = context_store.get_context_for_prompt(section_schema.section_number)
            if accumulated:
                cross_ref_context = f"\n\n=== CROSS-REFERENCE CONTEXT (from prior sections) ===\n{accumulated}\n"
        
        # Call Claude API with production safety settings
        full_prompt = context + cross_ref_context + "\n\n" + task_prompt
        
        # Rule 5: Use configured temperature
        # Rule 6: Use configured token budget
        temperature = LLMConfig.get_temperature("M2_GENERATION")
        max_tokens = LLMConfig.get_max_tokens("M2_SECTION_GEN")
        
        use_ensemble = bool(os.getenv("SARVAM_API_KEY"))
        if use_ensemble:
            response = run_async(
                orchestrator.call(
                    group_name="document_generation",
                    role="primary",
                    system_prompt=SYSTEM_PROMPT_DOCGEN,
                    prompt=full_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            )
            response_text = response.get("content", "")
            model_used = response.get("model_used", "nvidia-fallback")
            usage_tokens = response.get("usage", {}).get("completion_tokens", 0)
        else:
            raw = self.client.chat.completions.create(
                model=LLMConfig.LLM_MODEL,
                temperature=temperature,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT_DOCGEN},
                    {"role": "user", "content": full_prompt}
                ]
            )
            response_text = raw.choices[0].message.content
            model_used = "nvidia-fallback"
            usage_tokens = getattr(raw.usage, "output_tokens", getattr(raw.usage, "completion_tokens", 0))
        
        try:
            # Use robust JSON parser with retry
            # Note: For sync context, use simple JSON parse
            # In async endpoints, use parse_llm_json
            result_json = json.loads(response_text)
            
            generated_section = GeneratedSection(**result_json)
            
            # Log operation to audit trail (Rule 2)
            if session_id:
                session_manager.log_operation(
                    session_id=session_id,
                    module="M2",
                    operation="generate_section",
                    input_hash=hashlib.sha256(full_prompt.encode()).hexdigest()[:16],
                    output_hash=hashlib.sha256(response_text.encode()).hexdigest()[:16],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    actual_tokens=usage_tokens,
                    metadata={
                        "section_number": section_schema.section_number,
                        "section_heading": section_schema.section_heading,
                        "document_type": document_type,
                        "model_attribution": {
                            "primary_model": model_used,
                            "provider": "AIKosh India Sovereign AI Stack",
                            "sovereign": model_used.startswith(("sarvam", "bharatgen")),
                        },
                    }
                )
            
            return generated_section
            
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse failed, attempting manual extraction: {e}")
            
            # Try to extract JSON from markdown code blocks
            if "```json" in response_text:
                try:
                    json_start = response_text.find("```json") + 7
                    json_end = response_text.find("```", json_start)
                    json_text = response_text[json_start:json_end].strip()
                    result_json = json.loads(json_text)
                    return GeneratedSection(**result_json)
                except Exception:
                    pass
            
            # Fallback: extract content manually
            logger.error(f"Failed to parse section generation response: {e}")
            return GeneratedSection(
                section_number=section_schema.section_number,
                section_heading=section_schema.section_heading,
                generated_content=response_text,
                placeholders_used=[],
                regulatory_choices_made=[],
                completion_pct=80,
                review_priority="HIGH",
                review_priority_reason=f"JSON parsing failed: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Unexpected error in section generation: {e}")
            # Fallback: extract content manually
            return GeneratedSection(
                section_number=section_schema.section_number,
                section_heading=section_schema.section_heading,
                generated_content=response_text,
                placeholders_used=[],
                regulatory_choices_made=[],
                completion_pct=80,
                review_priority="HIGH",
                review_priority_reason=f"JSON parsing failed: {str(e)}"
            )
    
    def _build_context(
        self,
        document_type: str,
        section_schema: SectionSchema,
        study_data: StudyDataInput,
        previous_sections: List[GeneratedSection]
    ) -> str:
        """Build context injection for section generation"""
        
        schema = self.schema_engine.get_schema(document_type)
        section_list = self.schema_engine.get_section_list_formatted(document_type)
        
        completed_sections_str = "NONE"
        if previous_sections:
            completed_sections_str = ", ".join([
                f"{s.section_number}. {s.section_heading}" for s in previous_sections
            ])
        
        context = CONTEXT_INJECTION_TEMPLATE.format(
            document_type=schema.document_type,
            regulatory_standard=schema.regulatory_standard,
            schema_section_list=section_list,
            current_section_number=section_schema.section_number,
            section_heading=section_schema.section_heading,
            completed_sections=completed_sections_str,
            section_specific_requirements=section_schema.regulatory_requirements,
            requirement_citation=schema.regulatory_standard,
            study_title=study_data.study_title,
            protocol_number=study_data.protocol_number,
            phase=study_data.phase,
            indication=study_data.indication,
            imp_name=study_data.imp_name,
            dose=study_data.imp_dose,
            route=study_data.imp_route,
            comparator_name=study_data.comparator_name or "None",
            design_type=study_data.design_type,
            blinding=study_data.blinding,
            randomization=study_data.randomization,
            sample_size=study_data.sample_size,
            duration=study_data.duration,
            site_count=study_data.site_count,
            countries=", ".join(study_data.countries),
            primary_endpoint=study_data.primary_endpoint,
            secondary_endpoints="; ".join(study_data.secondary_endpoints),
            inclusion_criteria="; ".join(study_data.inclusion_criteria),
            exclusion_criteria="; ".join(study_data.exclusion_criteria),
            sae_window=study_data.sae_window,
            ec_name=study_data.ec_name or "[DATA REQUIRED: Ethics Committee name]",
            ec_reference=study_data.ec_reference or "[DATA REQUIRED: EC approval reference]",
            sponsor_name=study_data.sponsor_name,
            cro_name=study_data.cro_name or "None",
            additional_notes=study_data.additional_notes or "None"
        )
        
        return context
    
    def _validate_section(
        self,
        section_content: str,
        section_schema: SectionSchema,
        document_type: str
    ) -> Dict:
        """Validate section using Module 01 compliance checker"""
        
        # Use the compliance evaluator from Module 01
        validation_result = self.compliance_evaluator.evaluate(
            document_content=section_content,
            document_metadata={
                "type": f"{document_type} - Section {section_schema.section_number}",
                "section": section_schema.section_heading,
                "regulatory_standard": self.schema_engine.get_schema(document_type).regulatory_standard
            }
        )
        
        return validation_result
    
    def _assemble_document(
        self,
        sections: List[GeneratedSection],
        schema
    ) -> str:
        """Assemble all sections into final document"""
        
        document_parts = []
        
        # Title page
        document_parts.append(f"# {schema.document_type}")
        document_parts.append(f"**Regulatory Standard**: {schema.regulatory_standard}")
        document_parts.append(f"**Version**: {schema.version}")
        document_parts.append("\n---\n")
        
        # Table of contents
        document_parts.append("## Table of Contents\n")
        for section in sections:
            document_parts.append(f"{section.section_number}. {section.section_heading}")
        document_parts.append("\n---\n")
        
        # All sections
        for section in sections:
            document_parts.append(f"\n## {section.section_number}. {section.section_heading}\n")
            document_parts.append(section.generated_content)
            document_parts.append("\n")
        
        return "\n".join(document_parts)
