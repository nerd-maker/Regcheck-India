from __future__ import annotations

import uuid
import logging
import json
from datetime import datetime
from typing import Optional, Any
from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field

from db import get_conn

router = APIRouter(prefix="/submissions", tags=["submissions"])
logger = logging.getLogger(__name__)


class SubmissionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    type: str = Field(..., description="IND, NDA, CT-04, Schedule M, ANDA, NDA-505b2")
    phase: str = Field(..., description="Pre-IND, Phase I, Phase II, Phase III, Post-approval")
    product: str = Field(..., min_length=1, max_length=200)
    indication: str = Field(..., min_length=1, max_length=500)
    ha_authority: str = Field(default="CDSCO")
    target_submit_date: Optional[str] = None
    owner_name: str = Field(..., min_length=1, max_length=200)
    owner_initials: str = Field(..., min_length=1, max_length=5)
    owner_role: str = Field(default="Regulatory Lead")
    risk_level: str = Field(default="medium")
    frameworks: list[str] = Field(default_factory=list)
    application_id: Optional[str] = None


class SubmissionUpdate(BaseModel):
    name: Optional[str] = None
    state: Optional[str] = None
    state_label: Optional[str] = None
    target_submit_date: Optional[str] = None
    risk_level: Optional[str] = None
    open_gaps: Optional[int] = None
    compliance_score: Optional[int] = None
    frameworks: Optional[list[str]] = None


def row_to_dict(row: Any) -> dict[str, Any]:
    """Convert an asyncpg Record to a plain dict, parsing JSONB strings."""
    if row is None:
        return {}
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, str):
            stripped = v.strip()
            if (stripped.startswith('[') or stripped.startswith('{')):
                try:
                    d[k] = json.loads(stripped)
                except Exception:
                    pass
        elif hasattr(v, 'isoformat'):
            d[k] = v.isoformat()
    return d


def _generate_submission_number(count: int) -> str:
    """Format: SUB-2026-001"""
    year = datetime.now().year
    return f"SUB-{year}-{count + 1:03d}"


@router.get("")
@router.get("/")
async def list_submissions() -> dict[str, Any]:
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            "SELECT * FROM submissions WHERE state != 'archived' ORDER BY created_at DESC"
        )
        return {
            "submissions": [row_to_dict(r) for r in rows],
            "total": len(rows)
        }
    finally:
        await conn.close()


@router.post("", status_code=201)
async def create_submission(payload: SubmissionCreate) -> dict[str, Any]:
    conn = await get_conn()
    try:
        count_row = await conn.fetchval("SELECT COUNT(*) FROM submissions")
        number = _generate_submission_number(count_row)
        sub_id = f"s-{uuid.uuid4().hex[:8]}"
        now_str = datetime.now().strftime("%d %b %Y, %H:%M")

        await conn.execute("""
            INSERT INTO submissions (
                id, number, name, type, product, indication,
                state, state_label, ha_authority, phase,
                owner_id, owner_name, owner_initials, owner_role,
                target_submit_date, risk_level, documents, open_gaps,
                compliance_score, frameworks, application_id, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                'draft', 'Draft', $7, $8,
                $9, $10, $11, $12,
                $13, $14, 0, 0,
                0, $15::jsonb, $16, $17
            )
        """,
            sub_id, number, payload.name, payload.type,
            payload.product, payload.indication,
            payload.ha_authority, payload.phase,
            "p1",  # Hardcoded default owner ID matching system patterns
            payload.owner_name, payload.owner_initials, payload.owner_role,
            payload.target_submit_date, payload.risk_level,
            json.dumps(payload.frameworks), payload.application_id, now_str
        )

        row = await conn.fetchrow("SELECT * FROM submissions WHERE id = $1", sub_id)
        return row_to_dict(row)
    finally:
        await conn.close()


@router.get("/{submission_id}")
async def get_submission(submission_id: str) -> dict[str, Any]:
    conn = await get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT * FROM submissions WHERE id = $1", submission_id
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"Submission {submission_id} not found.")
        return row_to_dict(row)
    finally:
        await conn.close()


@router.patch("/{submission_id}")
async def update_submission(submission_id: str, payload: SubmissionUpdate) -> dict[str, Any]:
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    conn = await get_conn()
    try:
        row = await conn.fetchrow("SELECT id FROM submissions WHERE id = $1", submission_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Submission {submission_id} not found.")

        # Serialize list fields to JSON for database query
        if "frameworks" in updates:
            updates["frameworks"] = json.dumps(updates["frameworks"])

        set_clauses = []
        values = []
        for i, (k, v) in enumerate(updates.items()):
            set_clauses.append(f"{k} = ${i+2}")
            values.append(v)

        now_str = datetime.now().strftime("%d %b %Y, %H:%M")
        set_clauses.append(f"updated_at = ${len(updates)+2}")
        values.append(now_str)

        set_clause_str = ", ".join(set_clauses)
        query = f"UPDATE submissions SET {set_clause_str} WHERE id = $1"
        
        await conn.execute(query, submission_id, *values)
        updated = await conn.fetchrow("SELECT * FROM submissions WHERE id = $1", submission_id)
        return row_to_dict(updated)
    finally:
        await conn.close()


@router.delete("/{submission_id}", status_code=204, response_class=Response)
async def delete_submission(submission_id: str) -> Response:
    conn = await get_conn()
    try:
        row = await conn.fetchrow("SELECT id FROM submissions WHERE id = $1", submission_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Submission {submission_id} not found.")
        
        now_str = datetime.now().strftime("%d %b %Y, %H:%M")
        await conn.execute(
            "UPDATE submissions SET state = 'archived', updated_at = $2 WHERE id = $1",
            submission_id, now_str
        )
        return Response(status_code=204)
    finally:
        await conn.close()


@router.get("/{submission_id}/compliance-summary")
async def get_submission_compliance_summary(submission_id: str) -> dict[str, Any]:
    """
    Returns a stubbed compliance summary response for Sprint 3.
    """
    return {
        "submission_id": submission_id,
        "linked_documents": 0,
        "avg_compliance_score": None,
        "documents_by_state": {},
        "note": "Document-to-submission linking available in Sprint 4"
    }
