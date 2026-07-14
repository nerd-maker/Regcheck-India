from __future__ import annotations

import uuid
import logging
import json
from datetime import datetime
from typing import Optional, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db import get_conn

router = APIRouter(prefix="/correspondence", tags=["correspondence"])
logger = logging.getLogger(__name__)


class CorrespondenceCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    direction: str = Field(default="inbound", description="inbound or outbound")
    authority: str = Field(default="CDSCO")
    category: str = Field(..., description="Query, Deficiency Letter, Approval, Acknowledgment, Other")
    submission_id: Optional[str] = None
    received_at: str  # ISO date string
    due_at: Optional[str] = None
    priority: str = Field(default="standard", description="standard, high, critical")
    preview: str = Field(default="", max_length=500)


class CorrespondenceStateUpdate(BaseModel):
    state: str = Field(..., description="open, response-drafted, closed")


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


def _generate_correspondence_number(count: int) -> str:
    """Format: HA-2026-001"""
    year = datetime.now().year
    return f"HA-{year}-{count + 1:03d}"


@router.get("")
@router.get("/")
async def list_correspondence(submission_id: Optional[str] = None) -> dict[str, Any]:
    conn = await get_conn()
    if conn is None:
        return {"correspondence": [], "total": 0, "open_count": 0}
    try:
        if submission_id:
            rows = await conn.fetch(
                "SELECT * FROM ha_correspondence WHERE submission_id = $1 ORDER BY created_at DESC",
                submission_id
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM ha_correspondence ORDER BY created_at DESC"
            )
        records = [row_to_dict(r) for r in rows]
        return {
            "correspondence": records,
            "total": len(records),
            "open_count": sum(1 for r in records if r.get("state") in ("open", "response-drafted")),
        }
    finally:
        await conn.close()


@router.post("", status_code=201)
async def create_correspondence(payload: CorrespondenceCreate) -> dict[str, Any]:
    conn = await get_conn()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable — correspondence cannot be created.")
    try:
        count = await conn.fetchval("SELECT COUNT(*) FROM ha_correspondence")
        number = _generate_correspondence_number(count)
        item_id = f"h-{uuid.uuid4().hex[:8]}"

        await conn.execute("""
            INSERT INTO ha_correspondence (
                id, number, subject, direction, authority, category,
                submission_id, received_at, due_at, state, priority, preview
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', $10, $11)
        """,
            item_id, number, payload.subject, payload.direction,
            payload.authority, payload.category, payload.submission_id,
            payload.received_at, payload.due_at, payload.priority, payload.preview
        )
        row = await conn.fetchrow("SELECT * FROM ha_correspondence WHERE id = $1", item_id)
        return row_to_dict(row)
    finally:
        await conn.close()


@router.get("/{correspondence_id}")
async def get_correspondence(correspondence_id: str) -> dict[str, Any]:
    conn = await get_conn()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    try:
        row = await conn.fetchrow(
            "SELECT * FROM ha_correspondence WHERE id = $1", correspondence_id
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"Correspondence {correspondence_id} not found.")
        return row_to_dict(row)
    finally:
        await conn.close()


@router.patch("/{correspondence_id}/state")
async def update_correspondence_state(
    correspondence_id: str,
    payload: CorrespondenceStateUpdate
) -> dict[str, Any]:
    valid_states = {"open", "response-drafted", "closed"}
    if payload.state not in valid_states:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid state '{payload.state}'. Must be one of: {valid_states}"
        )
    conn = await get_conn()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    try:
        row = await conn.fetchrow(
            "SELECT id FROM ha_correspondence WHERE id = $1", correspondence_id
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"Correspondence {correspondence_id} not found.")
        
        await conn.execute(
            "UPDATE ha_correspondence SET state = $2 WHERE id = $1",
            correspondence_id, payload.state
        )
        updated = await conn.fetchrow(
            "SELECT * FROM ha_correspondence WHERE id = $1", correspondence_id
        )
        return row_to_dict(updated)
    finally:
        await conn.close()
