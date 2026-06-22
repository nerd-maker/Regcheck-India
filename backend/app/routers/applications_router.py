from __future__ import annotations

import uuid
import json
import logging
from datetime import datetime
from typing import Optional, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db import get_conn

router = APIRouter(prefix="/applications", tags=["applications"])
logger = logging.getLogger(__name__)


class ApplicationCreate(BaseModel):
    product: str = Field(..., min_length=1, max_length=200)
    sponsor: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., description="IND, NDA, ANDA, MAA, etc.")
    owner_name: str = Field(..., min_length=1, max_length=200)
    owner_initials: str = Field(..., min_length=1, max_length=5)


def row_to_dict(row: Any) -> dict[str, Any]:
    """Convert an asyncpg Record to a plain dict, parsing JSONB strings."""
    if row is None:
        return {}
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, str):
            stripped = v.strip()
            if stripped.startswith("[") or stripped.startswith("{"):
                try:
                    d[k] = json.loads(stripped)
                except Exception:
                    pass
        elif hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


def _generate_application_number(count: int) -> str:
    year = datetime.now().year
    return f"APP-{year}-{count + 1:03d}"


@router.get("")
@router.get("/")
async def list_applications(
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> dict[str, Any]:
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            "SELECT * FROM applications ORDER BY created_at DESC"
        )
        results = [row_to_dict(r) for r in rows]
        if status:
            results = [r for r in results if r.get("status") == status]
        if search:
            q = search.lower()
            results = [
                r for r in results
                if q in r.get("product", "").lower()
                or q in r.get("number", "").lower()
                or q in r.get("sponsor", "").lower()
            ]
        return {"applications": results, "total": len(results)}
    finally:
        await conn.close()


@router.post("", status_code=201)
async def create_application(payload: ApplicationCreate) -> dict[str, Any]:
    conn = await get_conn()
    try:
        aid = f"a-{uuid.uuid4().hex[:8]}"
        count = await conn.fetchval("SELECT COUNT(*) FROM applications")
        number = _generate_application_number(count)
        opened_at = datetime.now().strftime("%d %b %Y")

        await conn.execute(
            """
            INSERT INTO applications (
                id, number, product, sponsor, type, status,
                submissions, registrations, owner_id, owner_name,
                owner_initials, owner_role, opened_at
            ) VALUES ($1, $2, $3, $4, $5, 'Active', 0, 0, $1, $6, $7, 'Regulatory Lead', $8)
            """,
            aid, number, payload.product, payload.sponsor, payload.type,
            payload.owner_name, payload.owner_initials, opened_at,
        )
        row = await conn.fetchrow("SELECT * FROM applications WHERE id=$1", aid)
        return row_to_dict(row)
    finally:
        await conn.close()


@router.get("/{application_id}")
async def get_application(application_id: str) -> dict[str, Any]:
    conn = await get_conn()
    try:
        row = await conn.fetchrow(
            "SELECT * FROM applications WHERE id=$1", application_id
        )
        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Application {application_id} not found.",
            )
        return row_to_dict(row)
    finally:
        await conn.close()
