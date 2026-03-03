"""
Pydantic models for study data input schemas
"""
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class StudyDataInput(BaseModel):
    """Complete study data input for document generation"""
    
    # Basic Study Information
    study_title: str = Field(..., description="Full study title")
    protocol_number: str = Field(..., description="Protocol number and version")
    phase: str = Field(..., description="Study phase: I, II, III, IV, or Bioequivalence")
    indication: str = Field(..., description="Disease/condition being studied")
    
    # Investigational Product
    imp_name: str = Field(..., description="Investigational Medicinal Product name")
    imp_dose: str = Field(..., description="Dose and strength (e.g., '100 mg')")
    imp_route: str = Field(..., description="Route of administration (e.g., 'oral', 'IV')")
    imp_formulation: Optional[str] = Field(None, description="Formulation type (e.g., 'tablet', 'capsule')")
    
    # Comparator
    comparator_name: Optional[str] = Field(None, description="Comparator/control name or 'Placebo' or None")
    comparator_dose: Optional[str] = Field(None, description="Comparator dose if applicable")
    
    # Study Design
    design_type: str = Field(..., description="Design type: Parallel, Crossover, Factorial, etc.")
    blinding: str = Field(..., description="Blinding: Open-label, Single-blind, Double-blind, Triple-blind")
    randomization: str = Field(..., description="Randomization details (e.g., '1:1 ratio, stratified by age')")
    sample_size: int = Field(..., description="Total planned sample size")
    duration: str = Field(..., description="Total study duration (e.g., '12 weeks')")
    treatment_duration: Optional[str] = Field(None, description="Treatment period duration")
    followup_duration: Optional[str] = Field(None, description="Follow-up period duration")
    
    # Sites and Geography
    site_count: int = Field(..., description="Number of study sites")
    countries: List[str] = Field(..., description="List of countries (must include 'India')")
    
    # Endpoints
    primary_endpoint: str = Field(..., description="Primary efficacy endpoint")
    secondary_endpoints: List[str] = Field(..., description="List of secondary endpoints")
    exploratory_endpoints: Optional[List[str]] = Field(None, description="Exploratory endpoints if any")
    
    # Eligibility
    inclusion_criteria: List[str] = Field(..., description="Key inclusion criteria")
    exclusion_criteria: List[str] = Field(..., description="Key exclusion criteria")
    age_range: str = Field(..., description="Age range (e.g., '18-65 years')")
    
    # Safety
    sae_window: str = Field(
        default="14 days per NDCTR 2019",
        description="SAE reporting window"
    )
    
    # Ethics and Regulatory
    ec_name: Optional[str] = Field(None, description="Ethics Committee name")
    ec_reference: Optional[str] = Field(None, description="EC approval reference number")
    ctri_number: Optional[str] = Field(None, description="CTRI registration number")
    
    # Sponsor Information
    sponsor_name: str = Field(..., description="Sponsor organization name")
    sponsor_contact: Optional[str] = Field(None, description="Sponsor contact information")
    cro_name: Optional[str] = Field(None, description="CRO name if applicable")
    
    # Statistical
    alpha_level: float = Field(default=0.05, description="Statistical alpha level")
    power: float = Field(default=0.80, description="Statistical power")
    
    # Additional
    additional_notes: Optional[str] = Field(None, description="Any additional context or notes")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "study_title": "A Phase III, Randomized, Double-Blind, Placebo-Controlled Study to Evaluate the Efficacy and Safety of XYZ-123 in Patients with Type 2 Diabetes Mellitus",
            "protocol_number": "XYZ-123-P3-001 Version 2.0",
            "phase": "III",
            "indication": "Type 2 Diabetes Mellitus",
            "imp_name": "XYZ-123",
            "imp_dose": "50 mg",
            "imp_route": "oral",
            "imp_formulation": "tablet",
            "comparator_name": "Placebo",
            "comparator_dose": "matching placebo",
            "design_type": "Parallel group",
            "blinding": "Double-blind",
            "randomization": "1:1 ratio, stratified by HbA1c level",
            "sample_size": 200,
            "duration": "24 weeks",
            "treatment_duration": "12 weeks",
            "followup_duration": "12 weeks",
            "site_count": 10,
            "countries": ["India"],
            "primary_endpoint": "Change from baseline in HbA1c at Week 12",
            "secondary_endpoints": [
                "Change from baseline in fasting plasma glucose",
                "Proportion of patients achieving HbA1c <7%"
            ],
            "inclusion_criteria": [
                "Adults aged 18-65 years",
                "Diagnosis of Type 2 Diabetes Mellitus per ADA criteria",
                "HbA1c 7.0-10.0% at screening"
            ],
            "exclusion_criteria": [
                "Type 1 Diabetes Mellitus",
                "Severe hepatic impairment (ALT >3x ULN)",
                "Pregnant or breastfeeding women"
            ],
            "age_range": "18-65 years",
            "sae_window": "14 days per NDCTR 2019",
            "ec_name": "Institutional Ethics Committee, ABC Hospital",
            "sponsor_name": "XYZ Pharmaceuticals Ltd.",
            "alpha_level": 0.05,
            "power": 0.80
        }
    })


class ICFTranslationRequest(BaseModel):
    """Request model for ICF translation"""
    
    icf_content: str = Field(..., description="English ICF content to translate")
    target_language: str = Field(..., description="Target language code: hindi, tamil, marathi, bengali, telugu, kannada, gujarati, malayalam")
    icf_version: str = Field(..., description="ICF version number")
    study_title: Optional[str] = Field(None, description="Study title for context")


class GeneratedSection(BaseModel):
    """Model for a generated document section"""
    
    section_number: str
    section_heading: str
    generated_content: str
    placeholders_used: List[str]
    regulatory_choices_made: List[dict]
    completion_pct: int
    review_priority: str  # HIGH, MEDIUM, LOW
    review_priority_reason: str


class DocumentGenerationRequest(BaseModel):
    """Request model for document generation"""
    
    document_type: str = Field(..., description="Document type: protocol, icf, csr, ctri, ib")
    study_data: StudyDataInput
    generate_all_sections: bool = Field(default=True, description="Generate all sections or step-by-step")
    start_section: Optional[str] = Field(None, description="Section number to start from (for resuming)")


class SectionGenerationRequest(BaseModel):
    """Request model for single section generation"""
    
    document_type: str
    section_number: str
    study_data: StudyDataInput
    previous_sections: Optional[List[GeneratedSection]] = Field(None, description="Previously generated sections for context")
