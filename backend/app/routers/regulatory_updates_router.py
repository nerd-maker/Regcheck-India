"""
Regulatory Updates review router.

Endpoints for listing, reviewing, and approving scraped regulatory documents.
All scraped documents sit in regulatory_updates_queue pending human review
before being ingested into regulatory_embeddings.
"""
import logging
import sys
from pathlib import Path
from typing import Optional

import asyncpg
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter(prefix="/regulatory-updates", tags=["regulatory-updates"])
logger = logging.getLogger(__name__)


# ── Pydantic models ────────────────────────────────────────────────────────────

class ReviewDecision(BaseModel):
    status: str                        # "approved" or "rejected"
    reviewed_by: str                   # name of reviewer
    rejection_reason: Optional[str] = None


# ── Helper ─────────────────────────────────────────────────────────────────────

def _get_db_url() -> str:
    settings = get_settings()
    url = settings.supabase_db_url or settings.database_url
    if not url:
        raise HTTPException(status_code=500, detail="Database URL not configured.")
    return url


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("")
async def list_queued_updates(
    status: str = Query(default="pending_review"),
    limit: int = Query(default=50, le=100),
) -> dict:
    """List regulatory updates filtered by status."""
    try:
        conn = await asyncpg.connect(_get_db_url(), timeout=10.0)
    except Exception as e:
        logger.error("db_connect_failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Database connection failed: {e}")
    try:
        rows = await conn.fetch(
            """
            SELECT id, title, source_url, authority, framework,
                   document_type, publication_date, summary,
                   status, scraped_at, reviewed_at, reviewed_by,
                   rejection_reason, chunk_count, error_message
            FROM regulatory_updates_queue
            WHERE status = $1
            ORDER BY scraped_at DESC
            LIMIT $2
            """,
            status,
            limit,
        )
        return {
            "updates": [dict(r) for r in rows],
            "total": len(rows),
            "status_filter": status,
        }
    finally:
        await conn.close()


@router.get("/counts")
async def get_update_counts() -> dict:
    """Return item counts grouped by status — used for the nav badge."""
    try:
        conn = await asyncpg.connect(_get_db_url(), timeout=10.0)
    except Exception as e:
        logger.error("db_connect_failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Database connection failed: {e}")
    try:
        rows = await conn.fetch(
            """
            SELECT status, COUNT(*) AS count
            FROM regulatory_updates_queue
            GROUP BY status
            """
        )
        return {r["status"]: r["count"] for r in rows}
    finally:
        await conn.close()


@router.post("/trigger-scrape")
async def trigger_manual_scrape() -> dict:
    """
    Manually trigger a scrape run without waiting for the daily schedule.
    The job runs in a background asyncio task; results appear within 2-5 minutes.
    """
    import asyncio

    from app.services.regulatory_scraper import scrape_all_sources

    asyncio.create_task(scrape_all_sources())
    return {
        "message": (
            "Scrape triggered. Results will appear in the queue within 2-5 minutes."
        )
    }


@router.get("/{update_id}")
async def get_update_detail(update_id: int) -> dict:
    """Return full detail of a queued update, including extracted text."""
    try:
        conn = await asyncpg.connect(_get_db_url(), timeout=10.0)
    except Exception as e:
        logger.error("db_connect_failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Database connection failed: {e}")
    try:
        row = await conn.fetchrow(
            "SELECT * FROM regulatory_updates_queue WHERE id = $1", update_id
        )
        if not row:
            raise HTTPException(
                status_code=404, detail=f"Update {update_id} not found."
            )
        return dict(row)
    finally:
        await conn.close()


@router.patch("/{update_id}/review")
async def review_update(update_id: int, decision: ReviewDecision) -> dict:
    """
    Approve or reject a queued regulatory update.

    - approved → triggers ingestion into regulatory_embeddings, returns chunk_count.
    - rejected  → marks as rejected with mandatory reason.
    """
    if decision.status not in ("approved", "rejected"):
        raise HTTPException(
            status_code=422, detail="status must be 'approved' or 'rejected'."
        )

    try:
        conn = await asyncpg.connect(_get_db_url(), timeout=10.0)
    except Exception as e:
        logger.error("db_connect_failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Database connection failed: {e}")
    try:
        row = await conn.fetchrow(
            "SELECT * FROM regulatory_updates_queue WHERE id = $1", update_id
        )
        if not row:
            raise HTTPException(
                status_code=404, detail=f"Update {update_id} not found."
            )
        if row["status"] != "pending_review":
            raise HTTPException(
                status_code=422,
                detail=f"Cannot review update with status '{row['status']}'.",
            )

        if decision.status == "rejected":
            await conn.execute(
                """
                UPDATE regulatory_updates_queue
                SET status = 'rejected',
                    reviewed_at = NOW(),
                    reviewed_by = $2,
                    rejection_reason = $3
                WHERE id = $1
                """,
                update_id,
                decision.reviewed_by,
                decision.rejection_reason,
            )
            return {"id": update_id, "status": "rejected", "message": "Update rejected."}

        # ── Approved path: ingest into knowledge base ──────────────────────────
        await conn.execute(
            """
            UPDATE regulatory_updates_queue
            SET status = 'ingesting', reviewed_at = NOW(), reviewed_by = $2
            WHERE id = $1
            """,
            update_id,
            decision.reviewed_by,
        )

        try:
            # Resolve scripts/ directory relative to this file's location
            scripts_dir = Path(__file__).parent.parent.parent / "scripts"
            if str(scripts_dir) not in sys.path:
                sys.path.insert(0, str(scripts_dir))

            from ingest_regulatory_docs import ingest_single_document  # type: ignore[import]

            chunk_count = await ingest_single_document(
                conn=conn,
                doc_name=row["title"],
                framework=row["framework"] or row["authority"],
                extracted_text=row["extracted_text"],
                source_url=row["source_url"],
                publication_date=(
                    str(row["publication_date"]) if row["publication_date"] else None
                ),
                metadata={
                    "authority": row["authority"],
                    "document_type": row["document_type"],
                    "short_name": row["title"][:50],
                },
            )

            await conn.execute(
                """
                UPDATE regulatory_updates_queue
                SET status = 'ingested', chunk_count = $2
                WHERE id = $1
                """,
                update_id,
                chunk_count,
            )

            logger.info(
                "update_ingested: update_id=%d chunks=%d", update_id, chunk_count
            )
            return {
                "id": update_id,
                "status": "ingested",
                "chunk_count": chunk_count,
                "message": (
                    f"Approved and ingested {chunk_count} chunks into knowledge base."
                ),
            }

        except Exception as exc:
            await conn.execute(
                """
                UPDATE regulatory_updates_queue
                SET status = 'failed', error_message = $2
                WHERE id = $1
                """,
                update_id,
                str(exc),
            )
            logger.error(
                "ingestion_failed: update_id=%d error=%s", update_id, exc, exc_info=True
            )
            raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}")

    finally:
        await conn.close()
