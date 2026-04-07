"""
Pydantic schemas for RegCheck-India API.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime
from uuid import uuid4
from app.core.datetime_utils import utc_now


# Document Types
DocumentType = Literal[
    "Clinical Study Protocol",
    "Informed Consent Form",
    "Clinical Study Report",
    "Investigator's Brochure",
    "CTRI Registration Form",
    "CT-04 Form",
    "Other"
]

# Submission Targets
SubmissionTarget = Literal[
    "CDSCO CT-04",
    "CTRI Registration",
    "Ethics Committee",
    "WHO-PQ",
    "FDA ANDA",
    "Other"
]

# Trial Phases
TrialPhase = Literal[
    "Phase I",
    "Phase II",
    "Phase III",
    "Phase IV",
    "BA/BE Study",
    "Not Applicable"
]

# Compliance Status
ComplianceStatus = Literal["PASS", "PARTIAL", "FAIL", "NOT APPLICABLE", "UNVERIFIED"]

# Risk Levels
RiskLevel = Literal["HIGH", "MEDIUM", "LOW"]

# Confidence Levels
ConfidenceLevel = Literal["HIGH", "MEDIUM", "LOW"]


class DocumentMetadata(BaseModel):
    """Metadata for uploaded document."""
    document_type: DocumentType
    sponsor_name: str
    drug_name: str
    inn: Optional[str] = None
    trial_phase: TrialPhase
    submission_target: SubmissionTarget
    version: Optional[str] = None
    date: Optional[str] = None


class Finding(BaseModel):
    """Individual compliance finding."""
    finding_id: str
    section: str
    requirement: str
    citation: str
    current_text: Optional[str] = None
    status: ComplianceStatus
    gap: Optional[str] = None
    recommended_language: Optional[str] = None
    human_review_required: bool = False
    human_review_reason: Optional[str] = None


class FindingsBySatus(BaseModel):
    """Count of findings by status."""
    FAIL: int = 0
    PARTIAL: int = 0
    PASS: int = 0
    UNVERIFIED: int = 0


class EvaluationResponse(BaseModel):
    """Complete evaluation response."""
    model_config = ConfigDict(protected_namespaces=())
    evaluation_id: str = Field(default_factory=lambda: str(uuid4()))
    document_type: DocumentType
    overall_status: ComplianceStatus
    overall_risk: RiskLevel
    total_findings: int
    findings_by_status: FindingsBySatus
    findings: List[Finding]
    critical_blockers: List[str]
    missing_sections: List[str]
    evaluator_notes: Optional[str] = None
    confidence_level: ConfidenceLevel
    confidence_rationale: str
    timestamp: datetime = Field(default_factory=utc_now)
    model_attribution: Optional[dict] = None


class EvaluationRequest(BaseModel):
    """Request to evaluate a document."""
    file_id: str
    metadata: DocumentMetadata


class UploadResponse(BaseModel):
    """Response after file upload."""
    model_config = ConfigDict(protected_namespaces=())
    file_id: str
    filename: str
    file_size: int
    upload_timestamp: datetime = Field(default_factory=utc_now)
    model_attribution: Optional[dict] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    app_name: str
    version: str
    timestamp: datetime = Field(default_factory=utc_now)
