# backend/routers/agent_runs.py

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime
import asyncpg

router = APIRouter(prefix="/api/v1/agent-runs", tags=["Agent Runs"])

DATABASE_URL = os.getenv("DATABASE_URL")


async def get_db():
    if not DATABASE_URL:
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set DATABASE_URL environment variable."
        )
    return await asyncpg.connect(DATABASE_URL, timeout=10.0, statement_cache_size=0)


# ── Models ────────────────────────────────────────────────────────


class AgentRunCreate(BaseModel):
    submission_id: Optional[str] = None
    document_id: Optional[str] = None
    agent_id: str           # e.g. "m7-scheduley"
    agent_name: str         # e.g. "Schedule Y Check"
    filename: Optional[str] = None
    input_snippet: Optional[str] = None    # first 200 chars of input
    result_summary: Optional[str] = None   # first 500 chars of result
    compliance_score: Optional[float] = None   # 0-100 if extractable
    gap_count_critical: Optional[int] = None
    gap_count_major: Optional[int] = None
    gap_count_minor: Optional[int] = None
    status: str = "completed"   # completed | error


class AgentRunRecord(AgentRunCreate):
    id: str
    created_at: str


# ── Database init ─────────────────────────────────────────────────


async def init_db():
    """Call this on startup to create the table if it doesn't exist."""
    if not DATABASE_URL:
        print("DATABASE_URL not set — agent_runs persistence disabled.")
        return
    try:
        conn = await get_db()
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_runs (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                submission_id TEXT,
                document_id TEXT,
                agent_id TEXT NOT NULL,
                agent_name TEXT NOT NULL,
                filename TEXT,
                input_snippet TEXT,
                result_summary TEXT,
                compliance_score FLOAT,
                gap_count_critical INTEGER,
                gap_count_major INTEGER,
                gap_count_minor INTEGER,
                status TEXT DEFAULT 'completed',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_agent_runs_submission
            ON agent_runs(submission_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_agent_runs_agent
            ON agent_runs(agent_id, created_at DESC)
        """)
        await conn.close()
        print("agent_runs table ready.")
    except Exception as e:
        print(f"DB init warning: {e}")


# ── Endpoints ─────────────────────────────────────────────────────


@router.post("", response_model=AgentRunRecord)
async def create_agent_run(body: AgentRunCreate):
    """Save a completed agent run."""
    try:
        conn = await get_db()
        row = await conn.fetchrow("""
            INSERT INTO agent_runs (
                submission_id, document_id, agent_id, agent_name,
                filename, input_snippet, result_summary, compliance_score,
                gap_count_critical, gap_count_major, gap_count_minor, status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING *
        """,
            body.submission_id, body.document_id,
            body.agent_id, body.agent_name,
            body.filename, body.input_snippet,
            body.result_summary, body.compliance_score,
            body.gap_count_critical, body.gap_count_major,
            body.gap_count_minor, body.status
        )
        await conn.close()
        r = dict(row)
        r['created_at'] = r['created_at'].isoformat()
        return r
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[AgentRunRecord])
async def list_agent_runs(
    agent_id: Optional[str] = Query(None),
    submission_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200)
):
    """List agent runs, optionally filtered by agent or submission."""
    try:
        conn = await get_db()
        if agent_id and submission_id:
            rows = await conn.fetch("""
                SELECT * FROM agent_runs
                WHERE agent_id=$1 AND submission_id=$2
                ORDER BY created_at DESC LIMIT $3
            """, agent_id, submission_id, limit)
        elif agent_id:
            rows = await conn.fetch("""
                SELECT * FROM agent_runs
                WHERE agent_id=$1
                ORDER BY created_at DESC LIMIT $2
            """, agent_id, limit)
        elif submission_id:
            rows = await conn.fetch("""
                SELECT * FROM agent_runs
                WHERE submission_id=$1
                ORDER BY created_at DESC LIMIT $2
            """, submission_id, limit)
        else:
            rows = await conn.fetch("""
                SELECT * FROM agent_runs
                ORDER BY created_at DESC LIMIT $1
            """, limit)
        await conn.close()
        result = []
        for row in rows:
            r = dict(row)
            r['created_at'] = r['created_at'].isoformat()
            result.append(r)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trend/{agent_id}")
async def get_score_trend(
    agent_id: str,
    submission_id: Optional[str] = Query(None),
    limit: int = Query(10, le=50)
):
    """Get compliance score trend for an agent over time."""
    try:
        conn = await get_db()
        if submission_id:
            rows = await conn.fetch("""
                SELECT created_at, compliance_score,
                       gap_count_critical, gap_count_major, gap_count_minor,
                       filename, status
                FROM agent_runs
                WHERE agent_id=$1 AND submission_id=$2
                  AND compliance_score IS NOT NULL
                ORDER BY created_at ASC LIMIT $3
            """, agent_id, submission_id, limit)
        else:
            rows = await conn.fetch("""
                SELECT created_at, compliance_score,
                       gap_count_critical, gap_count_major, gap_count_minor,
                       filename, status
                FROM agent_runs
                WHERE agent_id=$1 AND compliance_score IS NOT NULL
                ORDER BY created_at ASC LIMIT $2
            """, agent_id, limit)
        await conn.close()
        data = []
        for row in rows:
            r = dict(row)
            r['created_at'] = r['created_at'].isoformat()
            data.append(r)
        return {
            "agent_id": agent_id,
            "submission_id": submission_id,
            "data_points": len(data),
            "trend": data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
