from __future__ import annotations

import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import get_db
from app.models.vault import (
    VaultComplianceScan,
    VaultDocument,
    VaultDocumentAudit,
    VaultDocumentVersion,
)
from app.services.compliance_scan_service import trigger_auto_scan
from app.services.doc_number_service import generate_doc_number
from app.services.extraction_service import extract_document_text
from app.services.storage_service import (
    build_storage_path,
    delete_file_from_storage,
    get_signed_download_url,
    upload_file_to_storage,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vault/documents", tags=["Document Vault"])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_STATES = {"draft", "in_review", "approved", "effective", "rejected", "superseded"}

# Valid lifecycle transitions: current_state -> set of allowed next states
VALID_TRANSITIONS: dict[str, set[str]] = {
    "draft":      {"in_review", "superseded"},
    "in_review":  {"approved", "draft", "superseded"},
    "approved":   {"effective", "superseded"},
    "effective":  {"superseded"},
    "superseded": set(),  # terminal state
    "rejected":   {"draft", "superseded"},
}


class StateTransitionRequest(BaseModel):
    new_state: str = Field(..., min_length=1)
    user_name: str = Field(..., min_length=1)
    user_initials: str = Field(..., min_length=1, max_length=6)
    reason: str | None = None


def _iso(value: datetime | None) -> str:
    return value.isoformat() if value else ""


def _version_schema(version: VaultDocumentVersion) -> dict[str, Any]:
    return {
        "id": version.id,
        "document_id": version.document_id,
        "version_number": version.version_number,
        "storage_path": version.storage_path,
        "file_name": version.file_name,
        "file_size_bytes": version.file_size_bytes,
        "uploaded_by": version.uploaded_by,
        "upload_note": version.upload_note,
        "created_at": _iso(version.created_at),
    }


def _audit_schema(entry: VaultDocumentAudit) -> dict[str, Any]:
    return {
        "id": entry.id,
        "document_id": entry.document_id,
        "action": entry.action,
        "from_state": entry.from_state,
        "to_state": entry.to_state,
        "user_name": entry.user_name,
        "user_initials": entry.user_initials,
        "note": entry.note,
        "created_at": _iso(entry.created_at),
    }


def _scan_schema(scan: VaultComplianceScan) -> dict[str, Any]:
    return {
        "id": scan.id,
        "document_id": scan.document_id,
        "scan_type": scan.scan_type,
        "status": scan.status,
        "score": scan.score,
        "findings": scan.findings,
        "agent_run_id": scan.agent_run_id,
        "created_at": _iso(scan.created_at),
    }


def _document_list_item(document: VaultDocument) -> dict[str, Any]:
    return {
        "id": document.id,
        "workspace_id": document.workspace_id,
        "doc_number": document.doc_number,
        "title": document.title,
        "doc_type": document.doc_type,
        "lifecycle_state": document.lifecycle_state,
        "current_version": document.current_version,
        "file_name": document.file_name,
        "file_size_bytes": document.file_size_bytes,
        "mime_type": document.mime_type,
        "page_count": document.page_count,
        "owner_name": document.owner_name,
        "owner_initials": document.owner_initials,
        "classification": document.classification,
        "created_at": _iso(document.created_at),
        "updated_at": _iso(document.updated_at),
    }


def _document_detail(document: VaultDocument) -> dict[str, Any]:
    return {
        **_document_list_item(document),
        "storage_path": document.storage_path,
        "storage_bucket": document.storage_bucket,
        "extracted_text": document.extracted_text,
        "versions": [_version_schema(version) for version in document.versions],
        "audit": [_audit_schema(entry) for entry in document.audit_entries],
        "compliance_scans": [_scan_schema(scan) for scan in document.compliance_scans],
    }


async def _get_document_or_404(db: AsyncSession, document_id: str) -> VaultDocument:
    result = await db.execute(
        select(VaultDocument)
        .where(VaultDocument.id == document_id)
        .options(
            selectinload(VaultDocument.versions),
            selectinload(VaultDocument.audit_entries),
            selectinload(VaultDocument.compliance_scans),
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Vault document not found")
    return document


@router.post("/upload")
async def upload_vault_document(
    file: UploadFile = File(...),
    workspace_id: str = Form(...),
    title: str | None = Form(None),
    doc_type: str = Form("Other"),
    owner_name: str = Form("Anika Sharma"),
    owner_initials: str = Form("AS"),
    classification: str = Form("Regulatory / General"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if not workspace_id.strip():
        raise HTTPException(status_code=400, detail="workspace_id is required")

    filename = file.filename or "document"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    file_bytes = await file.read()
    settings = get_settings()
    if len(file_bytes) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb}MB.",
        )

    document_id = str(uuid.uuid4())
    doc_number = await generate_doc_number(db, workspace_id)
    current_version = "1.0"
    storage_path = build_storage_path(
        workspace_id=workspace_id,
        document_id=document_id,
        version=current_version,
        filename=filename,
    )
    content_type = file.content_type or "application/octet-stream"

    await upload_file_to_storage(
        file_bytes=file_bytes,
        storage_path=storage_path,
        content_type=content_type,
    )

    try:
        extracted_text, page_count = await extract_document_text(file_bytes, filename)
        document = VaultDocument(
            id=document_id,
            workspace_id=workspace_id,
            doc_number=doc_number,
            title=title or filename,
            doc_type=doc_type,
            lifecycle_state="draft",
            current_version=current_version,
            storage_path=storage_path,
            storage_bucket=settings.supabase_storage_bucket,
            file_name=filename,
            file_size_bytes=len(file_bytes),
            mime_type=content_type,
            page_count=page_count,
            extracted_text=extracted_text,
            owner_name=owner_name,
            owner_initials=owner_initials,
            classification=classification,
        )
        db.add(document)
        db.add(
            VaultDocumentVersion(
                id=str(uuid.uuid4()),
                document_id=document_id,
                version_number=current_version,
                storage_path=storage_path,
                file_name=filename,
                file_size_bytes=len(file_bytes),
                uploaded_by=owner_name,
                upload_note="Initial upload",
            )
        )
        db.add(
            VaultDocumentAudit(
                id=str(uuid.uuid4()),
                document_id=document_id,
                action="uploaded",
                from_state=None,
                to_state="draft",
                user_name=owner_name,
                user_initials=owner_initials,
                note="Document uploaded to vault",
            )
        )
        db.add(
            VaultComplianceScan(
                id=str(uuid.uuid4()),
                document_id=document_id,
                scan_type="completeness",
                status="pending",
                findings=[],
            )
        )
        await db.flush()
        await db.refresh(document)
        return _document_list_item(document)
    except Exception:
        await delete_file_from_storage(storage_path=storage_path)
        raise


@router.get("/")
async def list_vault_documents(
    workspace_id: str | None = Query(None),
    lifecycle_state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(VaultDocument).order_by(VaultDocument.updated_at.desc())
    if workspace_id:
        stmt = stmt.where(VaultDocument.workspace_id == workspace_id)
    if lifecycle_state:
        state = "in_review" if lifecycle_state == "review" else lifecycle_state
        stmt = stmt.where(VaultDocument.lifecycle_state == state)

    result = await db.execute(stmt)
    documents = [_document_list_item(document) for document in result.scalars().all()]
    return {"documents": documents, "total": len(documents)}


@router.get("/audit-trail")
async def get_vault_audit_trail(
    workspace_id: str | None = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve all document audit trail events, joined with document titles/numbers."""
    stmt = (
        select(VaultDocumentAudit)
        .options(selectinload(VaultDocumentAudit.document))
        .join(VaultDocument, VaultDocumentAudit.document_id == VaultDocument.id)
    )
    if workspace_id:
        stmt = stmt.where(VaultDocument.workspace_id == workspace_id)

    stmt = stmt.order_by(VaultDocumentAudit.created_at.desc()).limit(limit)

    result = await db.execute(stmt)
    entries = result.scalars().all()

    audit_data = []
    for entry in entries:
        title = entry.document.title if entry.document else "Unknown"
        doc_number = entry.document.doc_number if entry.document else ""

        # Derive user initials defensively
        initials = entry.user_initials
        if not initials and entry.user_name:
            words = entry.user_name.split()
            initials = "".join([w[0].upper() for w in words if w])[:2]

        audit_data.append({
            "id": entry.id,
            "document_id": entry.document_id,
            "action": entry.action,
            "from_state": entry.from_state,
            "to_state": entry.to_state,
            "user_name": entry.user_name,
            "user_initials": initials or "SYS",
            "note": entry.note,
            "created_at": _iso(entry.created_at),
            "document_title": title,
            "doc_number": doc_number,
        })

    return {"audit_trail": audit_data, "total": len(audit_data)}


@router.get("/{document_id}")
async def get_vault_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    document = await _get_document_or_404(db, document_id)
    return _document_detail(document)


@router.patch("/{document_id}/state")
async def transition_vault_document_state(
    document_id: str,
    payload: StateTransitionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    new_state = "in_review" if payload.new_state == "review" else payload.new_state
    if new_state not in ALLOWED_STATES:
        raise HTTPException(status_code=400, detail=f"Unsupported lifecycle state: {payload.new_state}")

    document = await _get_document_or_404(db, document_id)
    old_state = document.lifecycle_state

    # Enforce valid transitions
    allowed_next = VALID_TRANSITIONS.get(old_state, set())
    if new_state not in allowed_next:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Cannot transition from '{old_state}' to '{new_state}'. "
                f"Valid transitions: {', '.join(sorted(allowed_next)) or 'none (terminal state)'}."
            ),
        )

    document.lifecycle_state = new_state
    db.add(
        VaultDocumentAudit(
            id=str(uuid.uuid4()),
            document_id=document.id,
            action="state_transition",
            from_state=old_state,
            to_state=new_state,
            user_name=payload.user_name,
            user_initials=payload.user_initials,
            note=payload.reason,
        )
    )
    await db.flush()
    result = await db.execute(
        select(VaultDocument)
        .where(VaultDocument.id == document.id)
        .options(
            selectinload(VaultDocument.versions),
            selectinload(VaultDocument.audit_entries),
            selectinload(VaultDocument.compliance_scans),
        )
        .execution_options(populate_existing=True)
    )
    refreshed = result.scalar_one()

    # Auto-trigger compliance scans when moving to in_review
    if new_state == "in_review":
        background_tasks.add_task(
            trigger_auto_scan,
            document_id=document_id,
            doc_type=document.doc_type,
        )
        logger.info(
            "auto_scan_scheduled document_id=%s doc_type=%s",
            document_id, document.doc_type,
        )

    return _document_detail(refreshed)


@router.get("/{document_id}/download-url")
async def get_vault_document_download_url(
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    document = await _get_document_or_404(db, document_id)
    signed_url = await get_signed_download_url(
        storage_path=document.storage_path,
        bucket=document.storage_bucket,
        expires_in=3600,
    )
    return {
        "document_id": document.id,
        "download_url": signed_url,
        "expires_in": 3600,
    }


@router.get("/{document_id}/scans")
async def get_compliance_scans(
    document_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Return all compliance scan results for a document, most recent first.

    Used by the Compliance Actions tab in the document detail inspector.
    """
    # Validate document exists
    await _get_document_or_404(db, document_id)

    result = await db.execute(
        select(VaultComplianceScan)
        .where(VaultComplianceScan.document_id == document_id)
        .order_by(VaultComplianceScan.created_at.desc())
    )
    scans = result.scalars().all()

    return {
        "document_id": document_id,
        "scans": [
            {
                "id": s.id,
                "document_id": s.document_id,
                "scan_type": s.scan_type,
                "status": s.status,
                "score": s.score,
                "findings": s.findings,
                "agent_run_id": s.agent_run_id,
                "created_at": _iso(s.created_at),
            }
            for s in scans
        ],
        "total": len(scans),
    }
