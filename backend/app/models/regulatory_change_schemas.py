"""
Pydantic models for Module 04: Regulatory Intelligence Monitor

Defines data structures for regulatory changes, impact assessments, and weekly digests.
"""

from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from datetime import datetime


# =============================================================================
# REGULATORY CHANGE MODELS
# =============================================================================

class RegulatoryDomain(BaseModel):
    """Regulatory domain classification"""
    domain: str
    is_primary: bool = False


class RegulatoryChange(BaseModel):
    """Structured regulatory change extracted from CDSCO/MOHFW documents"""
    
    change_id: str = Field(..., description="Unique ID: CHG-YYYYMMDD-sequence")
    domain: str = Field(..., description="Primary regulatory domain")
    change_type: Literal["NEW_REQUIREMENT", "AMENDMENT", "CLARIFICATION", "REPEAL", "DEFERRAL"]
    
    # Change details
    previous_requirement: str = Field(..., description="Old rule or NONE if new")
    new_requirement: str = Field(..., description="Exact new requirement")
    effective_date: str = Field(..., description="Date, IMMEDIATE, or UNCLEAR")
    transition_provisions: str = Field(..., description="Grandfathering or NONE STATED")
    
    # Affected parties
    affected_submission_types: List[str] = Field(default_factory=list, description="CT-04, ANDA, IND, NDA, BE, etc.")
    affected_product_categories: List[str] = Field(default_factory=list, description="New Drug, Generic, Biosimilar, OTC, etc.")
    
    # Source information
    source_section: str = Field(..., description="Section reference in source document")
    verbatim_text: str = Field(..., description="Exact quote from source (max 150 words)")
    source_citation: str = Field(..., description="Full document title, ref number, date")
    source_url: Optional[str] = None
    
    # Urgency assessment
    urgency: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    urgency_rationale: str
    action_window: str = Field(..., description="Days to respond before non-compliance")
    recommended_action: str
    
    # Summary
    plain_language_summary: str = Field(..., description="3-5 sentence executive summary")
    
    # Metadata
    detected_date: datetime = Field(default_factory=datetime.now)
    analyzed_by: str = "RegWatch-India AI"


class ChangeClassification(BaseModel):
    """Domain classification for new regulatory document"""
    
    primary_domain: str
    secondary_domains: List[str] = Field(default_factory=list)
    
    # Domain flags
    clinical_trial_conduct: bool = False
    pharmacovigilance: bool = False
    bioequivalence_ba: bool = False
    ethics_committee_process: bool = False
    ctri_registration: bool = False
    import_export_licence: bool = False
    gmp_gcp_glp_standards: bool = False
    patient_safety_reporting: bool = False
    new_drug_definition: bool = False
    other: Optional[str] = None
    
    classification_confidence: Literal["HIGH", "MEDIUM", "LOW"] = "MEDIUM"
    classification_rationale: str = ""


# =============================================================================
# IMPACT ASSESSMENT MODELS
# =============================================================================

class DocumentChange(BaseModel):
    """Required change to a submission document"""
    
    document: str = Field(..., description="Document name and version")
    affected_section: str = Field(..., description="Section heading")
    current_content_summary: str = Field(..., description="What it currently says")
    required_change: str = Field(..., description="What needs to change")
    change_urgency: Literal["BEFORE_NEXT_SUBMISSION", "WITHIN_30_DAYS", "MONITOR"]


class ActionItem(BaseModel):
    """Actionable recommendation for RA team"""
    
    action: str = Field(..., description="Specific action to take")
    owner: Literal["Sponsor", "CRO", "Site", "RA Team", "Ethics Committee"]
    deadline: str = Field(..., description="Date or relative timeframe")
    priority: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"] = "MEDIUM"


class SubmissionImpactAssessment(BaseModel):
    """Impact assessment of regulatory change on specific submission"""
    
    submission_id: str
    change_id: str
    
    # Impact status
    impact_status: Literal["IMPACTED", "LIKELY_IMPACTED", "MONITOR", "NOT_IMPACTED"]
    impact_rationale: str = Field(..., description="Why this submission is/isn't affected")
    
    # Document changes
    affected_documents: List[DocumentChange] = Field(default_factory=list)
    
    # Amendment requirements
    amendment_required: bool = False
    amendment_type: Optional[Literal["Protocol", "ICF", "IB", "CTRI Update", "Other"]] = None
    estimated_delay_risk: str = Field(..., description="Days of potential delay")
    
    # Actions
    recommended_actions: List[ActionItem] = Field(default_factory=list)
    
    # Review flags
    human_review_required: bool = True
    alert_text: str = Field(..., description="Plain language alert for RA team")
    
    # Metadata
    assessment_date: datetime = Field(default_factory=datetime.now)
    assessed_by: str = "RegWatch-India AI"


# =============================================================================
# SUBMISSION MODELS
# =============================================================================

class ActiveSubmission(BaseModel):
    """Active customer submission for impact assessment"""
    
    submission_id: str
    submission_type: Literal["CT-04", "ANDA", "IND", "NDA", "BE Study", "Other"]
    
    # Drug details
    drug_name: str
    phase: Optional[str] = None
    indication: Optional[str] = None
    
    # Status
    status: str = Field(..., description="SUBMISSION_STATUS")
    current_stage: str = Field(..., description="e.g., Ethics approval pending, CDSCO review")
    
    # Documents
    key_documents: List[str] = Field(default_factory=list, description="Document names with versions")
    
    # Metadata
    submission_date: Optional[datetime] = None
    sponsor_name: str
    customer_id: str


# =============================================================================
# WEEKLY DIGEST MODELS
# =============================================================================

class CriticalAction(BaseModel):
    """Critical action requiring immediate attention"""
    
    deadline: str
    action: str
    affected_parties: str
    change_id: str


class DetailedChange(BaseModel):
    """Detailed change entry for digest"""
    
    change_title: str
    effective_date: str
    affects: str = Field(..., description="Submission types and product categories")
    what_to_do: str
    source_citation: str
    urgency: str


class WeeklyDigest(BaseModel):
    """Weekly regulatory intelligence digest"""
    
    # Period
    period_start: str
    period_end: str
    
    # Counts
    new_documents_detected: int = 0
    changes_extracted: int = 0
    critical_high_urgency_changes: int = 0
    
    # Content sections
    executive_summary: str = Field(..., description="3-4 sentence overview")
    critical_actions: List[CriticalAction] = Field(default_factory=list)
    detailed_changes: List[DetailedChange] = Field(default_factory=list)
    monitoring_items: List[str] = Field(default_factory=list, description="Lower urgency changes")
    
    # Impact summary
    active_submissions_impacted: int = 0
    impact_summaries: List[str] = Field(default_factory=list)
    
    # Metadata
    generated_date: datetime = Field(default_factory=datetime.now)
    generated_by: str = "RegWatch-India AI"
    
    # No changes flag
    no_material_changes: bool = False


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class NewDocumentRequest(BaseModel):
    """Request to ingest new regulatory document"""
    
    source_url: str
    document_title: str
    publication_date: str
    document_type: Literal["Circular", "Guidance", "Amendment", "Notification", "Order"]
    full_text: str = Field(..., description="Full scraped text of document")


class ImpactAssessmentRequest(BaseModel):
    """Request to assess impact on submission"""
    
    change_id: str
    submission_id: str
    auto_generate_actions: bool = True


class DigestGenerationRequest(BaseModel):
    """Request to generate weekly digest"""
    
    start_date: str = Field(..., description="YYYY-MM-DD")
    end_date: str = Field(..., description="YYYY-MM-DD")
    include_low_urgency: bool = False


class ChangeListResponse(BaseModel):
    """Response for listing changes"""
    
    total_changes: int
    changes: List[RegulatoryChange]
    filters_applied: dict = Field(default_factory=dict)
