"""
FastAPI main application for RegCheck-India.
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pathlib import Path
import shutil
from uuid import uuid4
import json
import logging
import traceback
import os

import httpx
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.models.schemas import (
    HealthResponse,
    UploadResponse,
    EvaluationRequest,
    EvaluationResponse,
    DocumentMetadata
)
from app.services.document_parser import document_parser
from app.services.evaluator import compliance_evaluator
from app.services.knowledge_base import knowledge_base

# Production safety imports
from app.middleware.session_middleware import SessionTrackingMiddleware
from app.middleware.pii_middleware import PIIDetectionMiddleware
from app.services.session_manager import session_manager
from app.services.review_queue import review_queue
from app.services.kb_version_manager import kb_version_manager
from app.services.runtime_state_store import runtime_state_store
from app.config.llm_config import LLMConfig
from app.core.datetime_utils import utc_now
from agents_router import router as agents_router

logger = logging.getLogger(__name__)


def with_model_attribution(payload: dict, primary_model: str = "claude-sonnet-4-20250514", validator_model: str = None, ner_model: str = None):
    payload["model_attribution"] = {
        "primary_model": primary_model,
        "validator_model": validator_model,
        "ner_model": ner_model,
        "provider": "Anthropic Claude",
        "sovereign": False,
    }
    return payload


async def _probe_http_endpoint(url: str, enabled: bool) -> dict:
    if not enabled:
        return {"reachable": False, "status": "disabled"}

    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            response = await client.get(url)
        reachable = response.status_code < 500
        return {
            "reachable": reachable,
            "status": "ok" if reachable else "error",
            "http_status": response.status_code,
        }
    except Exception as exc:
        return {
            "reachable": False,
            "status": "error",
            "error": str(exc),
        }

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Pharmaceutical regulatory compliance evaluation for Indian regulations"
)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware registration order
# FastAPI processes middleware in REVERSE registration order.
# CORS registered FIRST = innermost wrapper = sees every response last,
# guaranteeing CORS headers are added to EVERY response including errors.

allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_raw.split(",")]
logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Other middleware (registered AFTER CORS)
from app.middleware.request_id_middleware import RequestIDMiddleware
app.add_middleware(RequestIDMiddleware)
app.add_middleware(PIIDetectionMiddleware)
app.add_middleware(SessionTrackingMiddleware)

# Register critical gap solution endpoints (Gaps 2-16)
from app.gap_endpoints import router as gap_router
app.include_router(gap_router)
from app.api import (
    anonymisation_endpoints,
    summarisation_endpoints,
    comparison_endpoints,
    classification_endpoints,
)
app.include_router(anonymisation_endpoints.router, prefix="/api/anonymise", tags=["Anonymisation"])
app.include_router(summarisation_endpoints.router, prefix="/api/summarise", tags=["Summarisation"])
app.include_router(comparison_endpoints.router, prefix="/api/compare", tags=["Comparison"])
app.include_router(classification_endpoints.router, prefix="/api/classify", tags=["Classification"])
app.include_router(agents_router, prefix="/api/v1/agents", tags=["AI Agents"])

# Create upload directory
UPLOAD_DIR = Path(settings.upload_dir)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# In-memory storage for uploaded files (in production, use database)
uploaded_files = {}

# =============================================================================
# VALIDATION ERROR HANDLER: returns detailed field-level errors for 422s
# =============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.url}: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)[:500]}
    )


# =============================================================================
# GLOBAL ERROR HANDLER: prevents stack trace leaks in production
# =============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler. Returns generic 500 in production."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    if settings.environment == "development":
        return JSONResponse(
            status_code=500,
            content={
                "detail": str(exc),
                "traceback": traceback.format_exc()
            }
        )
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."}
    )


# =============================================================================
# HEALTH & READINESS ENDPOINTS
# =============================================================================

@app.get("/health")
async def health_check_endpoint():
    """
    Health check for deployment platforms (Railway, Cloud Run, K8s).
    Returns 200 if the API process is alive.
    """
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


@app.get("/ready")
async def readiness_check():
    """
    Readiness probe checks all dependencies are connected:
    - ChromaDB is reachable
    - API key is configured
    """
    checks = {}
    all_ok = True

    # Check API key
    if os.getenv("ANTHROPIC_API_KEY"):
        checks["api_key"] = "configured"
    else:
        checks["api_key"] = "missing"
        all_ok = False

    # Check ChromaDB
    try:
        stats = knowledge_base.get_collection_stats()
        checks["chromadb"] = f"connected ({stats.get('total_documents', 0)} docs)"
    except Exception as e:
        checks["chromadb"] = f"error: {str(e)}"
        all_ok = False

    # Check runtime state store
    try:
        runtime_state_store.put("system", "readiness", "ping", {"ok": True})
        ping = runtime_state_store.get("system", "readiness", "ping", default={})
        checks["runtime_state_store"] = "connected" if ping.get("ok") else "error"
        if not ping.get("ok"):
            all_ok = False
    except Exception as e:
        checks["runtime_state_store"] = f"error: {str(e)}"
        all_ok = False

    status_code = 200 if all_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if all_ok else "not_ready",
            "checks": checks,
        }
    )


@app.get("/api/models/status")
async def model_status():
    """Shows which LLM models are active and healthy."""
    has_key = bool(os.getenv("ANTHROPIC_API_KEY"))

    # Quick connectivity probe
    claude_probe = {"reachable": False, "status": "disabled"}
    if has_key:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get("https://api.anthropic.com/v1/models", headers={
                    "x-api-key": os.getenv("ANTHROPIC_API_KEY", ""),
                    "anthropic-version": "2023-06-01",
                })
            reachable = resp.status_code == 200
            claude_probe = {
                "reachable": reachable,
                "status": "ok" if reachable else "error",
                "http_status": resp.status_code,
            }
        except Exception as exc:
            claude_probe = {"reachable": False, "status": "error", "error": str(exc)}

    status = {
        "claude-sonnet": {
            "active": has_key,
            "provider": "Anthropic",
            "model_id": "claude-sonnet-4-20250514",
            "used_for": ["M1 Compliance", "M2 Generation", "M3 Response", "M4 Intelligence", "M6 Comparison"],
            **claude_probe,
        },
        "claude-haiku": {
            "active": has_key,
            "provider": "Anthropic",
            "model_id": "claude-haiku-4-20250414",
            "used_for": ["M3 Classification", "M5 Summarisation", "M7 SAE Classification", "PII Detection"],
            **claude_probe,
        },
    }
    return {
        "models": status,
        "total_models": len(status),
        "platform_stack": "Anthropic Claude: Sonnet + Haiku",
        "model_attribution": {
            "primary_model": "system",
            "provider": "Anthropic Claude",
            "sovereign": False,
        },
    }


@app.get("/", response_model=HealthResponse)
async def root_health_check():
    """Root health check endpoint."""
    return HealthResponse(
        status="healthy",
        app_name=settings.app_name,
        version=settings.app_version
    )


@app.get("/api/kb/stats")
async def get_kb_stats():
    """Get knowledge base statistics."""
    try:
        stats = knowledge_base.get_collection_stats()
        return JSONResponse(content=with_model_attribution(stats, "claude-sonnet-4-20250514"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a pharmaceutical document for evaluation.
    
    Accepts PDF and DOCX files.
    """
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(settings.allowed_extensions)}"
        )
    
    # Validate file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    if file_size > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB"
        )
    
    # Generate unique file ID
    file_id = str(uuid4())
    file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Parse document
    try:
        parsed_doc = document_parser.parse_file(str(file_path))
        
        # Store file info
        uploaded_files[file_id] = {
            "filename": file.filename,
            "file_path": str(file_path),
            "file_size": file_size,
            "parsed_document": parsed_doc,
            "upload_timestamp": utc_now().isoformat()
        }
        
        return UploadResponse(
            file_id=file_id,
            filename=file.filename,
            file_size=file_size,
            model_attribution=with_model_attribution({}, "claude-sonnet-4-20250514")["model_attribution"],
        )
    
    except Exception as e:
        # Clean up file on error
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {str(e)}")


@app.post("/api/evaluate", response_model=EvaluationResponse)
async def evaluate_document(
    file_id: str = Form(...),
    metadata: str = Form(...)
):
    """
    Evaluate a document for regulatory compliance.
    
    Args:
        file_id: ID from upload endpoint
        metadata: JSON string of DocumentMetadata
    """
    # Check if file exists
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Parse metadata
    try:
        metadata_dict = json.loads(metadata)
        doc_metadata = DocumentMetadata(**metadata_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid metadata: {str(e)}")
    
    # Get parsed document
    file_info = uploaded_files[file_id]
    parsed_document = file_info["parsed_document"]
    
    # Evaluate document
    try:
        evaluation = compliance_evaluator.evaluate_document(
            parsed_document=parsed_document,
            metadata=doc_metadata
        )
        evaluation.model_attribution = with_model_attribution({}, "claude-sonnet-4-20250514")["model_attribution"]
        return evaluation
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@app.post("/api/kb/populate-sample")
async def populate_sample_kb():
    """Populate knowledge base with sample regulatory data."""
    try:
        from app.data.sample_regulations import get_sample_regulations
        
        sample_docs = get_sample_regulations()
        knowledge_base.add_bulk_documents(sample_docs)
        
        stats = knowledge_base.get_collection_stats()
        
        return JSONResponse(content={
            "message": "Sample regulatory data added successfully",
            "stats": stats
        } | {"model_attribution": with_model_attribution({}, "claude-sonnet-4-20250514")["model_attribution"]})
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to populate KB: {str(e)}")


# =============================================================================
# MODULE 02: DOCUMENT GENERATION ENDPOINTS
# =============================================================================

from app.services.document_generator import DocumentGenerator
from app.services.schema_engine import SchemaEngine
from app.models.study_data_schemas import (
    DocumentGenerationRequest,
    SectionGenerationRequest,
)

# Initialize Module 02 services
document_generator = DocumentGenerator()
schema_engine = SchemaEngine()


@app.post("/api/generate/document")
async def generate_document(request: DocumentGenerationRequest):
    """
    Generate a complete regulatory document section-by-section.
    
    Supports: protocol, icf, csr, ctri, ib
    """
    try:
        result = document_generator.generate_document(
            document_type=request.document_type,
            study_data=request.study_data,
            validate_inline=True
        )
        return JSONResponse(content=with_model_attribution(result, "claude-sonnet-4-20250514"))
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document generation failed: {str(e)}")


@app.post("/api/generate/section")
async def generate_section(request: SectionGenerationRequest):
    """
    Generate a single section of a document.
    
    Useful for manual step-through or regenerating specific sections.
    """
    try:
        section = document_generator.generate_single_section(
            document_type=request.document_type,
            section_number=request.section_number,
            study_data=request.study_data,
            previous_sections=request.previous_sections
        )
        return JSONResponse(content=with_model_attribution(section.model_dump(), "claude-sonnet-4-20250514"))
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Section generation failed: {str(e)}")





@app.get("/api/schemas/{document_type}")
async def get_document_schema(document_type: str):
    """
    Get the mandatory schema for a document type.
    
    Returns section structure, regulatory requirements, and guidelines.
    """
    try:
        schema = schema_engine.get_schema(document_type)
        return JSONResponse(content=with_model_attribution(schema.model_dump(), "claude-sonnet-4-20250514"))
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve schema: {str(e)}")


@app.get("/api/schemas")
async def list_available_schemas():
    """List all available document types with schemas."""
    try:
        document_types = schema_engine.get_available_document_types()
        return JSONResponse(content=with_model_attribution({
            "available_document_types": document_types
        }, "claude-sonnet-4-20250514"))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# MODULE 03: QUERY RESPONSE ASSISTANT ENDPOINTS
# =============================================================================

from app.services.query_classifier import QueryClassifier
from app.services.query_response_generator import QueryResponseGenerator
from app.models.query_schemas import (
    QueryClassificationRequest,
    QueryResponseRequest
)

# Initialize Module 03 services
query_classifier = QueryClassifier()
query_response_generator = QueryResponseGenerator()


@app.post("/api/query/classify")
async def classify_query(request: QueryClassificationRequest):
    """
    Classify a regulatory query into categories.
    
    Returns primary category, secondary categories, complexity, urgency, and data gaps.
    """
    try:
        classification = query_classifier.classify_query(
            query_text=request.query_text,
            query_reference=request.query_reference,
            response_deadline=request.response_deadline
        )
        return JSONResponse(content=with_model_attribution(classification.model_dump(), "claude-haiku-4-20250414"))
    
    except Exception as e:
        logger.error(f"Classification failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@app.post("/api/query/generate-response")
async def generate_query_response(request: QueryResponseRequest):
    """
    Generate structured response to a regulatory query.
    
    Includes regulatory context retrieval, template-based response generation,
    and commitment tracking.
    """
    try:
        response = query_response_generator.generate_response(
            query=request.query,
            classification=request.classification
        )
        return JSONResponse(content=with_model_attribution(response.model_dump(), "claude-sonnet-4-20250514"))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Response generation failed: {str(e)}")


@app.get("/api/query/categories")
async def get_query_categories():
    """List all available query categories with descriptions."""
    try:
        categories = query_classifier.get_all_categories()
        return JSONResponse(content=with_model_attribution({"categories": categories}, "claude-sonnet-4-20250514"))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/query/categories/{category_id}")
async def get_category_info(category_id: str):
    """Get detailed information about a specific query category."""
    try:
        category_info = query_classifier.get_category_info(category_id)
        if not category_info:
            raise HTTPException(status_code=404, detail=f"Category {category_id} not found")
        return JSONResponse(content=with_model_attribution(category_info, "claude-sonnet-4-20250514"))
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# MODULE 04: REGULATORY INTELLIGENCE MONITOR ENDPOINTS
# =============================================================================

from app.services.regulatory_change_analyzer import RegulatoryChangeAnalyzer
from app.services.submission_impact_assessor import SubmissionImpactAssessor
from app.services.weekly_digest_generator import WeeklyDigestGenerator
from app.services.regulatory_change_store import regulatory_change_store
from app.models.regulatory_change_schemas import (
    NewDocumentRequest,
    ImpactAssessmentRequest,
    DigestGenerationRequest,
    ChangeListResponse,
    ActiveSubmission
)

# Initialize Module 04 services
change_analyzer = RegulatoryChangeAnalyzer()
impact_assessor = SubmissionImpactAssessor()
digest_generator = WeeklyDigestGenerator()


@app.post("/api/regulatory/ingest")
async def ingest_regulatory_document(request: NewDocumentRequest):
    """
    Ingest new CDSCO/MOHFW regulatory document.
    
    Extracts structured changes and assesses urgency.
    Returns list of extracted changes.
    """
    try:
        # Get current KB summary for comparison (optional)
        kb_summary = ""
        try:
            kb_stats = knowledge_base.get_collection_stats()
            kb_summary = f"Knowledge base contains {kb_stats.get('total_documents', 0)} regulatory chunks."
        except:
            pass
        
        # Ingest and analyze document
        classification, changes = change_analyzer.ingest_new_document(
            document_request=request,
            kb_summary=kb_summary
        )
        
        # Save changes to store
        for change in changes:
            regulatory_change_store.save_change(change)
        
        # If CRITICAL/HIGH urgency, trigger impact assessment for all active submissions
        critical_high_changes = [c for c in changes if c.urgency in ["CRITICAL", "HIGH"]]
        if critical_high_changes:
            # Get all active submissions
            active_submissions = regulatory_change_store.list_submissions()
            
            # Assess impact for each critical/high change
            for change in critical_high_changes:
                assessments = impact_assessor.assess_multiple_submissions(
                    change=change,
                    submissions=active_submissions,
                    knowledge_base=knowledge_base
                )
                
                # Save assessments
                for assessment in assessments:
                    regulatory_change_store.save_impact_assessment(assessment)
        
        return JSONResponse(content=with_model_attribution({
            "status": "success",
            "classification": classification.model_dump(),
            "changes_extracted": len(changes),
            "changes": [c.model_dump() for c in changes],
            "critical_high_count": len(critical_high_changes)
        }, "claude-sonnet-4-20250514"))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document ingestion failed: {str(e)}")


@app.post("/api/regulatory/assess-impact")
async def assess_regulatory_impact(request: ImpactAssessmentRequest):
    """
    Assess impact of regulatory change on specific submission.
    
    Returns impact assessment with action items and alerts.
    """
    try:
        # Get change and submission
        change = regulatory_change_store.get_change(request.change_id)
        if not change:
            raise HTTPException(status_code=404, detail=f"Change {request.change_id} not found")
        
        submission = regulatory_change_store.get_submission(request.submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail=f"Submission {request.submission_id} not found")
        
        # Retrieve submission content
        submission_content = impact_assessor.retrieve_submission_content(
            submission=submission,
            change_domain=change.domain,
            knowledge_base=knowledge_base
        )
        
        # Assess impact
        assessment = impact_assessor.assess_impact(
            change=change,
            submission=submission,
            submission_content=submission_content
        )
        
        # Save assessment
        regulatory_change_store.save_impact_assessment(assessment)
        
        # Generate alert
        alert = impact_assessor.create_alert(assessment, change)
        
        return JSONResponse(content=with_model_attribution({
            "status": "success",
            "assessment": assessment.model_dump(),
            "alert": alert
        }, "claude-sonnet-4-20250514"))
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impact assessment failed: {str(e)}")


@app.post("/api/regulatory/generate-digest")
async def generate_weekly_digest(request: DigestGenerationRequest):
    """
    Generate weekly regulatory intelligence digest.
    
    Returns formatted digest for RA teams.
    """
    try:
        # Get changes for date range
        changes = regulatory_change_store.get_changes_by_date_range(
            start_date=request.start_date,
            end_date=request.end_date
        )
        
        # Filter by urgency if requested
        if not request.include_low_urgency:
            changes = [c for c in changes if c.urgency in ["CRITICAL", "HIGH", "MEDIUM"]]
        
        # Get impact assessments for date range
        impact_assessments = regulatory_change_store.get_all_impact_assessments(
            start_date=request.start_date,
            end_date=request.end_date
        )
        
        # Generate digest
        digest = digest_generator.generate_digest(
            changes=changes,
            impact_assessments=impact_assessments,
            start_date=request.start_date,
            end_date=request.end_date
        )
        
        # Export in multiple formats
        text_export = digest_generator.export_digest(digest, format="text")
        markdown_export = digest_generator.export_digest(digest, format="markdown")
        
        return JSONResponse(content=with_model_attribution({
            "status": "success",
            "digest": digest.model_dump(),
            "exports": {
                "text": text_export,
                "markdown": markdown_export
            }
        }, "claude-sonnet-4-20250514"))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Digest generation failed: {str(e)}")


@app.get("/api/regulatory/changes")
async def list_regulatory_changes(
    domain: str = None,
    urgency: str = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = 100
):
    """
    List regulatory changes with optional filters.
    
    Query params:
    - domain: Filter by regulatory domain
    - urgency: Filter by urgency level (CRITICAL, HIGH, MEDIUM, LOW)
    - start_date: Filter by detected date (YYYY-MM-DD)
    - end_date: Filter by detected date (YYYY-MM-DD)
    - limit: Maximum results (default 100)
    """
    try:
        changes = regulatory_change_store.list_changes(
            domain=domain,
            urgency=urgency,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
        
        response = ChangeListResponse(
            total_changes=len(changes),
            changes=changes,
            filters_applied={
                "domain": domain,
                "urgency": urgency,
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        return JSONResponse(content=with_model_attribution(response.model_dump(), "claude-sonnet-4-20250514"))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/regulatory/changes/{change_id}")
async def get_regulatory_change(change_id: str):
    """Get detailed information about a specific regulatory change."""
    try:
        change = regulatory_change_store.get_change(change_id)
        if not change:
            raise HTTPException(status_code=404, detail=f"Change {change_id} not found")
        
        # Get impact assessments for this change
        impacted_submissions = regulatory_change_store.get_impacted_submissions(change_id)
        
        return JSONResponse(content=with_model_attribution({
            "change": change.model_dump(),
            "impact_assessments": [ia.model_dump() for ia in impacted_submissions]
        }, "claude-sonnet-4-20250514"))
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/regulatory/submissions")
async def create_active_submission(submission: ActiveSubmission):
    """Register a new active submission for impact monitoring."""
    try:
        regulatory_change_store.save_submission(submission)
        return JSONResponse(content=with_model_attribution({
            "status": "success",
            "submission_id": submission.submission_id
        }, "claude-sonnet-4-20250514"))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/regulatory/submissions")
async def list_active_submissions(
    submission_type: str = None,
    status: str = None,
    limit: int = 100
):
    """List active submissions being monitored."""
    try:
        submissions = regulatory_change_store.list_submissions(
            submission_type=submission_type,
            status=status,
            limit=limit
        )
        
        return JSONResponse(content=with_model_attribution({
            "total_submissions": len(submissions),
            "submissions": [s.model_dump() for s in submissions]
        }, "claude-sonnet-4-20250514"))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/regulatory/stats")
async def get_regulatory_stats():
    """Get regulatory intelligence statistics."""
    try:
        stats = regulatory_change_store.get_stats()
        return JSONResponse(content=with_model_attribution(stats, "claude-sonnet-4-20250514"))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Register production safety endpoints (using APIRouter to avoid circular imports)
from app.production_endpoints import router as production_router
app.include_router(production_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.backend_port)


