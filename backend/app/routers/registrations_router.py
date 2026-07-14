from __future__ import annotations

import uuid
import json
import logging
from datetime import datetime
from typing import Optional, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db import get_conn

router = APIRouter(prefix="/registrations", tags=["registrations"])
logger = logging.getLogger(__name__)


class RegistrationCreate(BaseModel):
    product: str = Field(..., min_length=1, max_length=200)
    certificate: str = Field(..., min_length=1, max_length=200)
    market: str = Field(default="India")
    application_id: Optional[str] = None
    approved_date: str
    expiry_date: str


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


def _format_date(d_str: str) -> str:
    try:
        dt = datetime.strptime(d_str, "%Y-%m-%d")
        return dt.strftime("%d %b %Y")
    except Exception:
        return d_str


def _generate_registration_number(count: int) -> str:
    year = datetime.now().year
    return f"REG-{year}-{count + 1:03d}"


@router.get("")
@router.get("/")
async def list_registrations(
    state: Optional[str] = None,
    application_id: Optional[str] = None,
) -> dict[str, Any]:
    conn = await get_conn()
    if conn is None:
        return {"registrations": [], "total": 0}
    try:
        rows = await conn.fetch(
            "SELECT * FROM registrations ORDER BY created_at DESC"
        )
        results = [row_to_dict(r) for r in rows]
        if state:
            results = [r for r in results if r.get("state") == state]
        if application_id:
            results = [r for r in results if r.get("application_id") == application_id]
        return {"registrations": results, "total": len(results)}
    finally:
        await conn.close()


@router.post("", status_code=201)
async def create_registration(payload: RegistrationCreate) -> dict[str, Any]:
    conn = await get_conn()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable — registration cannot be created.")
    try:
        rid = f"r-{uuid.uuid4().hex[:8]}"
        count = await conn.fetchval("SELECT COUNT(*) FROM registrations")
        number = _generate_registration_number(count)
        app_date = _format_date(payload.approved_date)
        exp_date = _format_date(payload.expiry_date)
        app_id = payload.application_id.strip() if payload.application_id else None
        if app_id == "":
            app_id = None

        await conn.execute(
            """
            INSERT INTO registrations (
                id, number, product, certificate, market, state,
                approved_date, expiry_date, application_id
            ) VALUES ($1, $2, $3, $4, $5, 'Effective', $6, $7, $8)
            """,
            rid, number, payload.product, payload.certificate,
            payload.market, app_date, exp_date, app_id,
        )
        if app_id:
            await conn.execute(
                "UPDATE applications SET registrations = registrations + 1 WHERE id = $1",
                app_id,
            )
        row = await conn.fetchrow("SELECT * FROM registrations WHERE id=$1", rid)
        return row_to_dict(row)
    finally:
        await conn.close()


@router.get("/{registration_id}")
async def get_registration(registration_id: str) -> dict[str, Any]:
    conn = await get_conn()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    try:
        row = await conn.fetchrow(
            "SELECT * FROM registrations WHERE id=$1", registration_id
        )
        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Registration {registration_id} not found.",
            )
        return row_to_dict(row)
    finally:
        await conn.close()
