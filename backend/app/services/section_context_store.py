"""
Section Cross-Reference Context Store (Gap 15)

Maintains shared context during M2 section-by-section generation:
- After each section, extracts key defined terms
- Injects accumulated context into subsequent section prompts
- Post-generation cross-reference validation pass
- Explicit consistency checks for 5 critical cross-references
"""

import json
import uuid
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.config.llm_config import LLMConfig

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Cross-Reference Definitions
# ──────────────────────────────────────────────────────

# Map of critical cross-reference terms, where they are defined,
# and which sections need to reference them consistently
CROSS_REFERENCE_MAP = {
    "primary_endpoint": {
        "defined_in": ["study_design", "objectives", "endpoints"],
        "referenced_by": ["statistical_methods", "sample_size", "safety_monitoring"],
        "description": "Primary efficacy endpoint definition"
    },
    "sample_size": {
        "defined_in": ["sample_size_justification", "statistical_methods"],
        "referenced_by": ["study_design", "randomization"],
        "description": "Total sample size and per-arm allocation"
    },
    "randomization_procedure": {
        "defined_in": ["randomization", "study_design"],
        "referenced_by": ["statistical_methods", "blinding"],
        "description": "Randomization ratio and method"
    },
    "primary_analysis": {
        "defined_in": ["statistical_methods"],
        "referenced_by": ["study_design", "sample_size_justification"],
        "description": "Primary statistical analysis method"
    },
    "sae_definition": {
        "defined_in": ["safety_monitoring", "adverse_events"],
        "referenced_by": ["pharmacovigilance", "data_collection", "statistical_methods"],
        "description": "SAE definition and reporting criteria"
    }
}


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class ContextEntry(BaseModel):
    """Single extracted term in the context store"""
    value: Any
    defined_in: str  # Section name where term was defined
    defined_at: datetime = Field(default_factory=datetime.utcnow)


class ExtractionLog(BaseModel):
    """Record of what was extracted from a section"""
    section: str
    terms_extracted: List[str] = Field(default_factory=list)
    new_terms: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CrossRefCheck(BaseModel):
    """Result of checking one cross-reference"""
    reference: str  # e.g. "primary_endpoint"
    consistent: bool
    status: str  # CONSISTENT, INCONSISTENT, NOT_DEFINED, NOT_REFERENCED
    established_value: Optional[str] = None
    defined_in: Optional[str] = None
    mismatches: List[Dict] = Field(default_factory=list)


class CrossRefValidationResult(BaseModel):
    """Full cross-reference validation result"""
    overall_consistent: bool
    checks_performed: int
    inconsistencies_found: int
    results: List[CrossRefCheck] = Field(default_factory=list)


# ──────────────────────────────────────────────────────
# Section Context Store
# ──────────────────────────────────────────────────────

class SectionContextStore:
    """
    Shared context accumulated during M2 section generation.

    After each section is generated, key terms are extracted and stored.
    All subsequent section prompts receive the accumulated context.
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.context: Dict[str, ContextEntry] = {}
        self.section_order: List[str] = []
        self.extraction_log: List[ExtractionLog] = []

    def store_terms(self, section_name: str, terms: Dict[str, Any]):
        """
        Store extracted terms from a generated section.

        First definition wins — subsequent sections reference, not redefine.
        """
        new_terms = []
        all_terms = []

        for key, value in terms.items():
            if not value:
                continue
            all_terms.append(key)

            if key not in self.context:
                self.context[key] = ContextEntry(
                    value=value,
                    defined_in=section_name
                )
                new_terms.append(key)

        self.section_order.append(section_name)
        self.extraction_log.append(ExtractionLog(
            section=section_name,
            terms_extracted=all_terms,
            new_terms=new_terms
        ))

        logger.info(
            f"Context store updated after {section_name}: "
            f"{len(new_terms)} new terms ({len(self.context)} total)",
            extra={
                "session_id": self.session_id,
                "section": section_name,
                "new_terms": new_terms
            }
        )

    def get_context_for_prompt(self) -> str:
        """
        Get accumulated context formatted for LLM prompt injection.

        Returns readable text to insert into the next section's system prompt.
        """
        if not self.context:
            return "No previous sections have been generated yet."

        lines = [
            "=== CROSS-REFERENCE CONTEXT (from previously generated sections) ===",
            "You MUST be consistent with these established values.",
            "Do NOT redefine or contradict any of the below.",
            ""
        ]

        for key, entry in self.context.items():
            readable_key = key.replace("_", " ").title()
            val = entry.value
            # Truncate long values
            if isinstance(val, str) and len(val) > 200:
                val = val[:200] + "..."
            elif isinstance(val, list):
                val = ", ".join(str(v) for v in val[:5])
            lines.append(f"  • {readable_key}: {val}  (defined in: {entry.defined_in})")

        lines.append("")
        lines.append("=== END CONTEXT ===")
        return "\n".join(lines)

    def get_context_json(self) -> Dict:
        """Get raw context for programmatic use."""
        return {k: v.value for k, v in self.context.items()}

    def get_term(self, term_name: str) -> Optional[Any]:
        """Get a specific term value."""
        entry = self.context.get(term_name)
        return entry.value if entry else None


# ──────────────────────────────────────────────────────
# Cross-Reference Validator
# ──────────────────────────────────────────────────────

class CrossReferenceValidator:
    """
    Validates cross-reference consistency across complete assembled document.

    Runs AFTER all sections are generated, before final output.
    """

    def validate_document(
        self,
        sections: List[Dict],
        context_store: SectionContextStore
    ) -> CrossRefValidationResult:
        """
        Validate cross-references in assembled document.

        Args:
            sections: List of {"name": str, "text": str}
            context_store: Populated context store from generation

        Returns:
            CrossRefValidationResult with consistency checks
        """
        results = []

        for ref_name in LLMConfig.CRITICAL_CROSS_REFERENCES:
            ref_spec = CROSS_REFERENCE_MAP.get(ref_name, {})
            check = self._check_reference(ref_name, ref_spec, sections, context_store)
            results.append(check)

        inconsistencies = [r for r in results if not r.consistent]

        overall = CrossRefValidationResult(
            overall_consistent=len(inconsistencies) == 0,
            checks_performed=len(results),
            inconsistencies_found=len(inconsistencies),
            results=results
        )

        if not overall.overall_consistent:
            logger.warning(
                f"Cross-reference inconsistencies found: {len(inconsistencies)}",
                extra={
                    "session_id": context_store.session_id,
                    "inconsistencies": [
                        {"ref": r.reference, "mismatches": r.mismatches}
                        for r in inconsistencies
                    ]
                }
            )
        else:
            logger.info("All cross-references consistent")

        return overall

    def _check_reference(
        self,
        ref_name: str,
        ref_spec: Dict,
        sections: List[Dict],
        context_store: SectionContextStore
    ) -> CrossRefCheck:
        """Check a single cross-reference for consistency."""

        established = context_store.context.get(ref_name)

        if not established:
            return CrossRefCheck(
                reference=ref_name,
                consistent=True,
                status="NOT_DEFINED"
            )

        # Check which sections reference this term
        referenced_by = ref_spec.get("referenced_by", [])
        mismatches = []

        for section in sections:
            section_name = section.get("name", "").lower().replace(" ", "_")
            section_text = section.get("text", "")

            # For sections that should reference this term, check presence
            if section_name in referenced_by or any(
                rb in section_name for rb in referenced_by
            ):
                value_str = str(established.value).lower()
                if value_str and len(value_str) > 3 and value_str not in section_text.lower():
                    mismatches.append({
                        "section": section["name"],
                        "expected": str(established.value),
                        "issue": f"'{ref_name}' value not found in section text"
                    })

        return CrossRefCheck(
            reference=ref_name,
            consistent=len(mismatches) == 0,
            status="CONSISTENT" if not mismatches else "INCONSISTENT",
            established_value=str(established.value),
            defined_in=established.defined_in,
            mismatches=mismatches
        )


# ──────────────────────────────────────────────────────
# Convenience: Context-Aware Section Generation Helper
# ──────────────────────────────────────────────────────

def build_section_prompt_with_context(
    section_name: str,
    section_schema: Dict,
    user_inputs: Dict,
    context_store: SectionContextStore,
    template: str = ""
) -> str:
    """
    Build a section generation prompt with cross-reference context injected.

    Use this in the M2 document generator to ensure consistency.
    """
    context_block = context_store.get_context_for_prompt()

    prompt = f"""Generate the {section_name} section of a clinical trial protocol.

{context_block}

Section requirements:
{json.dumps(section_schema, indent=2, default=str)}

User inputs:
{json.dumps(user_inputs, indent=2, default=str)}

IMPORTANT: You MUST reference the exact values from the cross-reference
context above. Do not invent new values for terms already defined.
"""
    if template:
        prompt += f"\nTemplate:\n{template}"

    return prompt


# Global instances
cross_reference_validator = CrossReferenceValidator()
