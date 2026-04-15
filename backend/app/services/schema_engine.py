"""
Schema Engine for Document Generation

Loads and validates document schemas, provides schema-based document structure
"""
import json
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel


class SectionSchema(BaseModel):
    """Schema for a document section"""
    section_number: str
    section_heading: str
    required: bool
    subsections: List[str]
    regulatory_requirements: str
    word_count_guidance: str
    special_instructions: Optional[str] = None


class DocumentSchema(BaseModel):
    """Complete document schema"""
    document_type: str
    regulatory_standard: str
    version: str
    description: str
    sections: List[SectionSchema]
    appendices: Optional[List[str]] = None


class SchemaEngine:
    """Manages document schemas and structure enforcement"""
    
    def __init__(self, schemas_dir: str = "app/data/document_schemas"):
        self.schemas_dir = Path(schemas_dir)
        self._schemas_cache: Dict[str, DocumentSchema] = {}
        self._load_schemas()
    
    def _load_schemas(self):
        """Load all schemas from the schemas directory"""
        if not self.schemas_dir.exists():
            raise FileNotFoundError(f"Schemas directory not found: {self.schemas_dir}")
        
        schema_files = {
            "protocol": "protocol_schema.json",
            "icf": "icf_schema.json",
            "csr": "csr_schema.json",
            "ctri": "ctri_schema.json",
            "ib": "ib_schema.json"
        }
        
        for doc_type, filename in schema_files.items():
            schema_path = self.schemas_dir / filename
            if schema_path.exists():
                with open(schema_path, 'r', encoding='utf-8') as f:
                    schema_data = json.load(f)
                    # Convert sections to SectionSchema objects
                    sections = [SectionSchema(**section) for section in schema_data.get('sections', [])]
                    schema_data['sections'] = sections
                    self._schemas_cache[doc_type] = DocumentSchema(**schema_data)
    
    def get_schema(self, document_type: str) -> DocumentSchema:
        """Get schema for a specific document type"""
        doc_type_lower = document_type.lower()
        if doc_type_lower not in self._schemas_cache:
            raise ValueError(f"Schema not found for document type: {document_type}")
        return self._schemas_cache[doc_type_lower]
    
    def get_section_schema(self, document_type: str, section_number: str) -> SectionSchema:
        """Get schema for a specific section"""
        schema = self.get_schema(document_type)
        for section in schema.sections:
            if section.section_number == section_number:
                return section
        raise ValueError(f"Section {section_number} not found in {document_type} schema")
    
    def get_all_sections(self, document_type: str) -> List[SectionSchema]:
        """Get all sections for a document type"""
        schema = self.get_schema(document_type)
        return schema.sections
    
    def get_section_list_formatted(self, document_type: str) -> str:
        """Get formatted list of all sections for prompt injection"""
        sections = self.get_all_sections(document_type)
        formatted = []
        for section in sections:
            formatted.append(f"{section.section_number}. {section.section_heading}")
        return "\n".join(formatted)
    
    def validate_section_completeness(self, section_number: str, content: str, document_type: str) -> Dict:
        """Validate if a section meets minimum requirements"""
        section_schema = self.get_section_schema(document_type, section_number)
        
        validation_result = {
            "section_number": section_number,
            "section_heading": section_schema.section_heading,
            "is_complete": True,
            "missing_elements": [],
            "warnings": []
        }
        
        # Check if all subsections are mentioned
        for subsection in section_schema.subsections:
            if subsection.lower() not in content.lower():
                validation_result["missing_elements"].append(subsection)
                validation_result["is_complete"] = False
        
        # Check word count guidance
        word_count = len(content.split())
        if section_schema.word_count_guidance:
            # Parse guidance like "500-1000 words"
            if "-" in section_schema.word_count_guidance:
                try:
                    min_words, max_words = section_schema.word_count_guidance.split("-")
                    min_words = int(min_words.strip().split()[0])
                    max_words = int(max_words.strip().split()[0])
                    
                    if word_count < min_words:
                        validation_result["warnings"].append(
                            f"Section may be too short ({word_count} words, recommended {min_words}-{max_words})"
                        )
                    elif word_count > max_words * 1.5:  # Allow 50% overage
                        validation_result["warnings"].append(
                            f"Section may be too long ({word_count} words, recommended {min_words}-{max_words})"
                        )
                except:
                    pass
        
        return validation_result
    
    def get_available_document_types(self) -> List[str]:
        """Get list of available document types"""
        return list(self._schemas_cache.keys())


INSPECTION_REPORT_SCHEMA = {
    "type": "inspection_report",
    "sections": [
        {"id": "site_details", "title": "Site Identification Details", "mandatory": True, "cdsco_template_ref": "GMP_INSP_01"},
        {"id": "inspection_team", "title": "Inspection Team Details", "mandatory": True},
        {"id": "scope", "title": "Scope of Inspection", "mandatory": True},
        {"id": "observations", "title": "Observations", "mandatory": True, "classification": ["Critical", "Major", "Minor"]},
        {"id": "gmp_compliance", "title": "GMP Compliance Assessment", "mandatory": True},
        {"id": "capa_requirements", "title": "CAPA Requirements", "mandatory": True},
        {"id": "conclusion", "title": "Inspection Conclusion", "mandatory": True},
    ],
}


class InspectionObservationConverter:
    """Converts unstructured observations to formal inspection report JSON."""

    async def convert(self, raw_observations: str, site_details: dict) -> dict:
        from app.services.claude_client import MODEL_SONNET, call_claude
        import json

        prompt = f"""
        You are a CDSCO GMP inspector writing a formal inspection report.
        Convert raw observations into CDSCO report format per Schedule M.
        Classify each as CRITICAL / MAJOR / MINOR and cite GMP clause.
        Raw Observations:
        {raw_observations}
        Site Details:
        {site_details}
        Return structured JSON only.
        """
        result = call_claude(
            prompt=prompt,
            system_prompt="Return valid JSON only.",
            model=MODEL_SONNET,
            max_tokens=1600,
            temperature=0.0,
        )
        content = result["content"]
        try:
            return json.loads(content)
        except Exception:
            return {"raw": content}
