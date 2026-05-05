"""Anonymisation endpoints (Phase 1)."""

import io
import json
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.models.hackathon_schemas import AnonymisationReport, AnonymisationResponse, SummariseTextRequest
from app.services.document_parser import document_parser
from app.services.pii_detector import LEGAL_FRAMEWORK_MAP, pii_detector
from app.services.runtime_state_store import runtime_state_store

router = APIRouter()

_SESSION_REPORTS = {}

_DOC_CONTENT_TYPES = {
    ".pdf": {"application/pdf"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
    },
    ".txt": {"text/plain"},
}

_STRUCTURED_CONTENT_TYPES = {
    ".csv": {"text/csv", "application/csv", "application/vnd.ms-excel"},
    ".json": {"application/json", "text/json"},
}


def _ensure_session_access(session_id: str, x_session_id: str):
    if session_id != x_session_id:
        raise HTTPException(status_code=403, detail="Session access denied")


from app.services.file_cleanup import validate_file, FileValidationError

async def _read_validated_upload(file: UploadFile, allowed_types: dict[str, set[str]]) -> tuple[str, bytes]:
    """Uses robust security validation for file uploads."""
    content = await file.read()
    try:
        file_info = validate_file(
            content=content,
            filename=file.filename or "upload",
            allowed_extensions=list(allowed_types.keys())
        )
        return file_info["extension"], content
    except FileValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _build_response(session_id: str, content: str, report: dict) -> AnonymisationResponse:
    by_type = report.get("redactions_by_type", {})
    audit_log = pii_detector.audit_logger.get_session_entries(session_id)
    frameworks = sorted({f.split("_Section")[0] for entries in LEGAL_FRAMEWORK_MAP.values() for f in entries})
    response = AnonymisationResponse(
        anonymised_content=content,
        entities_detected=report.get("total_redactions", 0),
        entities_anonymised=report.get("total_redactions", 0),
        compliance_frameworks=frameworks,
        audit_log=audit_log,
        anonymisation_report=AnonymisationReport(
            by_type=by_type,
            step1_pseudonymised=report.get("soft_pii_count", 0),
            step2_irreversibly_anonymised=max(0, report.get("total_redactions", 0) - report.get("soft_pii_count", 0)),
        ),
    )
    payload = response.model_dump()
    _SESSION_REPORTS[session_id] = payload
    runtime_state_store.put("anonymisation", session_id, "report", payload)
    return response


def _with_attr(payload: dict, primary_model: str = "regex+claude") -> dict:
    payload["model_attribution"] = {
        "primary_model": primary_model,
        "provider": "Anthropic Claude",
        "sovereign": False,
    }
    return payload


@router.post("/text")
async def anonymise_text(request: SummariseTextRequest, x_session_id: str = Header(default="default_session")):
    if request.full_anonymisation:
        anonymised, report = pii_detector.detect_and_redact(
            request.text, preserve_context=True, session_id=x_session_id, full_anonymisation=True
        )
    else:
        anonymised, report = pii_detector.pseudonymise_text(request.text, session_id=x_session_id)
    payload = _with_attr(_build_response(x_session_id, anonymised, report).model_dump())
    return JSONResponse(content=payload)


@router.post("/document")
async def anonymise_document(
    file: UploadFile = File(...),
    full_anonymisation: bool = Form(default=True),
    x_session_id: str = Header(default="default_session"),
):
    suffix, raw = await _read_validated_upload(file, _DOC_CONTENT_TYPES)
    tmp = Path("uploads") / f"anon_{x_session_id}{suffix}"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    try:
        tmp.write_bytes(raw)
        if suffix in [".pdf", ".docx"]:
            text = document_parser.parse_file(str(tmp)).get("full_text", "")
        else:
            text = raw.decode("utf-8", errors="ignore")
        if full_anonymisation:
            anonymised, report = pii_detector.detect_and_redact(
                text, preserve_context=True, session_id=x_session_id, full_anonymisation=True
            )
        else:
            anonymised, report = pii_detector.pseudonymise_text(text, session_id=x_session_id)
        return JSONResponse(content=_with_attr(_build_response(x_session_id, anonymised, report).model_dump()))
    finally:
        if tmp.exists():
            tmp.unlink(missing_ok=True)


@router.post("/structured")
async def anonymise_structured(file: UploadFile = File(...), x_session_id: str = Header(default="default_session")):
    import pandas as pd

    suffix, raw = await _read_validated_upload(file, _STRUCTURED_CONTENT_TYPES)
    if suffix == ".csv":
        df = pd.read_csv(io.BytesIO(raw))
    elif suffix == ".json":
        data = json.loads(raw.decode("utf-8", errors="ignore"))
        df = pd.DataFrame(data)
    else:
        raise HTTPException(status_code=400, detail="Supported structured types: CSV, JSON")
    cols = pii_detector.structured_anonymiser.auto_detect_pii_columns(df)
    anonymised_df = pii_detector.structured_anonymiser.anonymise_dataframe(df, cols)
    content = anonymised_df.to_json(orient="records")
    report = {
        "total_redactions": sum(len(anonymised_df[col]) for col in cols),
        "soft_pii_count": 0,
        "redactions_by_type": {col: len(anonymised_df[col]) for col in cols},
    }
    return JSONResponse(content=_with_attr(_build_response(x_session_id, content, report).model_dump()))


@router.get("/audit/{session_id}")
async def get_audit_log(session_id: str, x_session_id: str = Header(default="default_session")):
    _ensure_session_access(session_id, x_session_id)
    return _with_attr({"session_id": session_id, "audit_log": pii_detector.audit_logger.get_session_entries(session_id)})


@router.get("/report/{session_id}")
async def get_report(session_id: str, x_session_id: str = Header(default="default_session")):
    _ensure_session_access(session_id, x_session_id)
    report = runtime_state_store.get("anonymisation", session_id, "report", default=None)
    if report is None:
        report = _SESSION_REPORTS.get(session_id, {"detail": "No report found for session"})
    return _with_attr(report)
