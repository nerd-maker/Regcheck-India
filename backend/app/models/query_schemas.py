"""
Pydantic models for query response schemas
"""
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import date


class QueryInput(BaseModel):
    """Input model for a regulatory query"""
    
    query_text: str = Field(..., description="Full text of the regulatory query")
    query_reference: str = Field(..., description="CDSCO/EC query reference number")
    query_date: str = Field(..., description="Date query was received (YYYY-MM-DD)")
    response_deadline: Optional[str] = Field(None, description="Response deadline (YYYY-MM-DD)")
    
    submission_type: str = Field(..., description="Type of submission: CT-04, ANDA, IND, etc.")
    submission_date: str = Field(..., description="Original submission date")
    
    submission_documents: List[dict] = Field(
        default_factory=list,
        description="Available documents with name, version, and content/path"
    )
    
    prior_response: Optional[str] = Field(None, description="Prior response if this is a re-query")
    
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "query_text": "The sample size justification provided in the protocol is not adequate. Please provide detailed calculation with assumptions.",
            "query_reference": "CDSCO/CT/2024/001/Q1",
            "query_date": "2024-02-15",
            "response_deadline": "2024-03-01",
            "submission_type": "CT-04",
            "submission_date": "2024-01-10",
            "submission_documents": [
                {
                    "name": "Clinical Trial Protocol",
                    "version": "2.0",
                    "date": "2024-01-05"
                }
            ],
            "prior_response": None
        }
    })


class QueryClassification(BaseModel):
    """Classification result for a query"""
    
    primary_category: str = Field(..., description="Primary category ID (CAT-XX)")
    secondary_categories: List[str] = Field(
        default_factory=list,
        description="Secondary category IDs"
    )
    
    complexity: str = Field(..., description="SIMPLE, MODERATE, or COMPLEX")
    urgency: str = Field(..., description="HIGH, MEDIUM, or LOW")
    data_gap: str = Field(..., description="YES, PARTIAL, or NO")
    data_gap_detail: str = Field(default="", description="Details of missing information")
    
    recommended_template: str = Field(..., description="Recommended response template ID")
    classification_confidence: str = Field(..., description="HIGH, MEDIUM, or LOW")
    reasoning: str = Field(default="", description="Explanation of classification")
    
    # Gap 11: Added by classify_query after confidence assessment
    classification_routing: Optional[str] = Field(None, description="AUTO_PROCEED or MANUAL_REVIEW")
    requires_confirmation: Optional[bool] = Field(None, description="Whether user confirmation needed")


class Commitment(BaseModel):
    """A sponsor commitment extracted from a response"""
    
    type: str = Field(..., description="Type of commitment")
    description: str = Field(..., description="What will be done")
    timeline: Optional[str] = Field(None, description="When it will be done")
    responsible_party: Optional[str] = Field(None, description="Who will do it")
    priority: str = Field(default="MEDIUM", description="HIGH, MEDIUM, or LOW")


class QueryResponse(BaseModel):
    """Generated response to a regulatory query"""
    
    response_text: str = Field(..., description="Full formatted response text")
    
    commitments_made: List[str] = Field(
        default_factory=list,
        description="List of sponsor commitments"
    )
    
    additional_info_needed: List[str] = Field(
        default_factory=list,
        description="Information gaps requiring sponsor input"
    )
    
    confidence: str = Field(..., description="HIGH, MEDIUM, or LOW")
    
    reviewer_flags: List[str] = Field(
        default_factory=list,
        description="Items requiring specific reviewer attention"
    )
    
    supporting_documents_referenced: List[str] = Field(
        default_factory=list,
        description="Documents cited in response"
    )


class QueryResponseRequest(BaseModel):
    """Request model for query response generation"""
    
    query: QueryInput
    classification: Optional[QueryClassification] = Field(
        None,
        description="Pre-classified query. If None, will auto-classify"
    )
    auto_classify: bool = Field(
        default=True,
        description="Whether to auto-classify if classification not provided"
    )


class QueryClassificationRequest(BaseModel):
    """Request model for query classification only"""
    
    query_text: str
    query_reference: Optional[str] = None
    response_deadline: Optional[str] = None


class CommitmentTrackingEntry(BaseModel):
    """Entry for tracking a commitment"""
    
    commitment_id: str
    query_reference: str
    commitment: Commitment
    status: str = Field(default="PENDING", description="PENDING, IN_PROGRESS, COMPLETED, OVERDUE")
    created_date: str
    due_date: Optional[str] = None
    completion_date: Optional[str] = None
    notes: Optional[str] = None
