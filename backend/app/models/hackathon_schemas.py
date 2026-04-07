"""Pydantic schemas for Stage-1 hackathon modules (M5-M7 + anonymisation)."""

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class AnonymisationReport(BaseModel):
    by_type: Dict[str, int] = Field(default_factory=dict)
    step1_pseudonymised: int = 0
    step2_irreversibly_anonymised: int = 0


class AnonymisationResponse(BaseModel):
    anonymised_content: str
    entities_detected: int
    entities_anonymised: int
    compliance_frameworks: List[str] = Field(default_factory=list)
    audit_log: List[Dict] = Field(default_factory=list)
    anonymisation_report: AnonymisationReport


class SummariseTextRequest(BaseModel):
    text: str
    full_anonymisation: bool = True


class SUGAMSummaryRequest(BaseModel):
    document_text: str
    checklist_type: str = "ct04"


class SAECaseSummaryRequest(BaseModel):
    sae_text: str


class MeetingSummaryRequest(BaseModel):
    transcript_text: str


class VersionCompareRequest(BaseModel):
    doc_v1_text: str
    doc_v2_text: str
    doc_type: str


class CompletenessRequest(BaseModel):
    data: Dict
    form_type: Literal["CT04", "SAE"] = "CT04"


class SAEClassifyRequest(BaseModel):
    sae_text: str


class SAEBatchClassifyRequest(BaseModel):
    sae_texts: List[str]


class SAEDuplicateRequest(BaseModel):
    sae_case: Dict


class PriorityQueueRequest(BaseModel):
    cases: List[Dict]
