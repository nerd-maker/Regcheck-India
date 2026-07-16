# backend/app/core/database.py
"""
SQLAlchemy 2.x async engine and session factory for the Document Vault Engine.

IMPORTANT: This module is used ONLY by the vault router.  The rest of the
backend (workspace, agent_runs) continues to use raw asyncpg via db.py.
Mixing both in the same request is safe because the vault router never calls
get_conn() and the workspace router never calls get_db() — they use different
connection pools.
"""
from __future__ import annotations

import logging
import asyncpg
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Engine — created lazily on first access so import never fails if DATABASE_URL
# is missing at module-load time (e.g. during tests with env vars overridden).
# ---------------------------------------------------------------------------
_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _get_engine():
    global _engine, _session_factory
    if _engine is None:
        cfg = get_settings()
        raw_url = cfg.database_url
        if not raw_url:
            raise RuntimeError(
                "DATABASE_URL is not set.  "
                "Add it to your Render / local .env file."
            )
        # asyncpg driver requires postgresql+asyncpg:// scheme
        if raw_url.startswith("postgres://"):
            raw_url = raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif raw_url.startswith("postgresql://") and "+asyncpg" not in raw_url:
            raw_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        _engine = create_async_engine(
            raw_url,
            pool_size=5,
            max_overflow=5,
            pool_pre_ping=True,
            echo=False,
        )
        _session_factory = async_sessionmaker(
            _engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )
        logger.info("SQLAlchemy async engine initialised for vault router.")
    return _engine, _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a per-request AsyncSession.

    Returns 503 if the database engine cannot be initialised (e.g. DATABASE_URL
    not set) or if the session factory fails — never propagates as a raw 500.

    Usage in a router:
        from app.core.database import get_db
        from fastapi import Depends

        @router.get("/")
        async def my_endpoint(db: AsyncSession = Depends(get_db)):
            ...
    """
    try:
        _, factory = _get_engine()
    except Exception as e:
        logger.warning("SQLAlchemy engine init failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Database temporarily unavailable. Workspace features are offline.",
        )

    try:
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
    except HTTPException:
        raise  # pass through 404/422 etc unchanged
    except Exception as e:
        logger.warning("SQLAlchemy session failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Database temporarily unavailable. Workspace features are offline.",
        )


@asynccontextmanager
async def get_async_session() -> AsyncIterator[AsyncSession]:
    """Async context manager for DB sessions outside of FastAPI request context.

    Used by background tasks (e.g. compliance scans) that manage their own
    session lifecycle.  Always commits on clean exit, rolls back on error.

    Usage::

        async with get_async_session() as db:
            result = await db.execute(select(VaultDocument).where(...))
    """
    _, factory = _get_engine()
    session = factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_pgvector_conn() -> asyncpg.Connection:
    import urllib.parse
    import os
    raw_url = os.environ.get("PGVECTOR_URL") or os.environ.get("SUPABASE_DB_URL")
    
    if raw_url:
        # Parse URL and pass components individually to avoid special char encoding issues
        parsed = urllib.parse.urlparse(raw_url)
        host = parsed.hostname or "localhost"
        ssl_val = "require" if host and "supabase" in host else None
        return await asyncpg.connect(
            host=host,
            port=parsed.port or 5432,
            user=parsed.username,
            password=urllib.parse.unquote(parsed.password) if parsed.password else None,
            database=parsed.path.lstrip("/") or "postgres",
            ssl=ssl_val,
            timeout=3.0,
            statement_cache_size=0
        )
    else:
        # Fallback to individual env vars
        host = os.environ.get("PGVECTOR_HOST") or "localhost"
        ssl_val = "require" if host and "supabase" in host else None
        return await asyncpg.connect(
            host=host,
            port=int(os.environ.get("PGVECTOR_PORT", 5432)),
            user=os.environ.get("PGVECTOR_USER", "postgres"),
            password=os.environ.get("PGVECTOR_PASSWORD"),
            database=os.environ.get("PGVECTOR_DATABASE", "postgres"),
            ssl=ssl_val,
            timeout=3.0,
            statement_cache_size=0
        )

