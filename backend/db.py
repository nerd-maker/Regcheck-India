# backend/db.py
# Shared DB helpers — all routers import from here

import logging
import os
import urllib.parse

import asyncpg

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

# ---------------------------------------------------------------------------
# Connection pool — created once at lifespan startup, shared across requests
# ---------------------------------------------------------------------------
_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    """Create the asyncpg connection pool. Call once from lifespan startup."""
    global _pool
    if _pool is not None:
        return  # already initialised

    from urllib.parse import urlparse
    from app.core.config import get_settings

    settings = get_settings()

    # Prefer individual env-var credentials when available
    if settings.supabase_db_password or settings.supabase_db_host != "aws-0-ap-southeast-2.pooler.supabase.com":
        from app.core.database import get_pgvector_conn
        # pgvector path uses its own direct connection; fall back to URL-based pool
        url = os.getenv("SUPABASE_DB_URL") or DATABASE_URL
    else:
        url = DATABASE_URL

    if not url:
        logger.warning("DATABASE_URL not set — workspace persistence disabled; pool not created.")
        return

    parsed = urlparse(url)
    host     = parsed.hostname or "localhost"
    port     = parsed.port or 5432
    user     = parsed.username or "postgres"
    password = urllib.parse.unquote(parsed.password or "")
    database = (parsed.path or "/postgres").lstrip("/") or "postgres"
    ssl_val  = "require" if "supabase" in host else None

    _pool = await asyncpg.create_pool(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        ssl=ssl_val,
        statement_cache_size=0,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    logger.info("asyncpg connection pool created (min=2 max=10) host=%s", host)


async def close_pool() -> None:
    """Gracefully close the pool at shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("asyncpg connection pool closed")


async def get_conn():
    """Acquire a connection from the pool (preferred) or open a direct connection.

    Usage — always use as an async context manager or close() manually:
        conn = await get_conn()
        try:
            ...
        finally:
            await conn.close()  # returns to pool
    """
    if _pool is not None:
        return await _pool.acquire()

    # Pool not yet initialised (e.g. during init_all_tables before lifespan)
    # Fall back to a direct connection.
    from urllib.parse import urlparse
    from app.core.config import get_settings
    settings = get_settings()

    if settings.supabase_db_password or settings.supabase_db_host != "aws-0-ap-southeast-2.pooler.supabase.com":
        from app.core.database import get_pgvector_conn
        return await get_pgvector_conn()

    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Add it to your Render environment variables."
        )
    parsed   = urlparse(DATABASE_URL)
    host     = parsed.hostname or "localhost"
    port     = parsed.port or 5432
    user     = parsed.username or "postgres"
    password = urllib.parse.unquote(parsed.password or "")
    database = (parsed.path or "/postgres").lstrip("/") or "postgres"
    ssl_val  = "require" if "supabase" in host else None
    return await asyncpg.connect(
        host=host, port=port, user=user, password=password,
        database=database, ssl=ssl_val,
        statement_cache_size=0, timeout=10.0,
    )



async def init_all_tables():
    """Create all tables on startup. Safe to call multiple times (idempotent)."""
    if not DATABASE_URL:
        print("DATABASE_URL not set — workspace persistence disabled.")
        return

    conn = await get_conn()
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY,
                number TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                product TEXT NOT NULL,
                indication TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'draft',
                state_label TEXT,
                ha_authority TEXT NOT NULL DEFAULT 'CDSCO',
                phase TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                owner_name TEXT NOT NULL,
                owner_initials TEXT NOT NULL,
                owner_role TEXT NOT NULL,
                target_submit_date TEXT,
                risk_level TEXT NOT NULL DEFAULT 'medium',
                documents INTEGER NOT NULL DEFAULT 0,
                open_gaps INTEGER NOT NULL DEFAULT 0,
                compliance_score INTEGER NOT NULL DEFAULT 0,
                frameworks JSONB NOT NULL DEFAULT '[]',
                application_id TEXT,
                updated_at TEXT NOT NULL DEFAULT 'just now',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                number TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                classification TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'draft',
                version TEXT NOT NULL DEFAULT '0.1',
                owner_id TEXT NOT NULL,
                owner_name TEXT NOT NULL,
                owner_initials TEXT NOT NULL,
                owner_role TEXT NOT NULL,
                country TEXT NOT NULL DEFAULT 'India',
                language TEXT NOT NULL DEFAULT 'en',
                size TEXT NOT NULL DEFAULT '0 KB',
                updated_at TEXT NOT NULL DEFAULT 'just now',
                updated_by TEXT NOT NULL,
                submission_id TEXT,
                application_id TEXT,
                compliance_score INTEGER,
                flags JSONB NOT NULL DEFAULT '[]',
                excerpt TEXT,
                file_path TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id TEXT PRIMARY KEY,
                number TEXT NOT NULL,
                product TEXT NOT NULL,
                sponsor TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Active',
                submissions INTEGER NOT NULL DEFAULT 0,
                registrations INTEGER NOT NULL DEFAULT 0,
                owner_id TEXT NOT NULL,
                owner_name TEXT NOT NULL,
                owner_initials TEXT NOT NULL,
                owner_role TEXT NOT NULL,
                opened_at TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS registrations (
                id TEXT PRIMARY KEY,
                number TEXT NOT NULL,
                product TEXT NOT NULL,
                certificate TEXT NOT NULL,
                market TEXT NOT NULL DEFAULT 'India',
                state TEXT NOT NULL DEFAULT 'Effective',
                approved_date TEXT NOT NULL,
                expiry_date TEXT NOT NULL,
                application_id TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS ha_correspondence (
                id TEXT PRIMARY KEY,
                number TEXT NOT NULL,
                subject TEXT NOT NULL,
                direction TEXT NOT NULL DEFAULT 'inbound',
                authority TEXT NOT NULL DEFAULT 'CDSCO',
                category TEXT NOT NULL,
                submission_id TEXT,
                received_at TEXT NOT NULL,
                due_at TEXT,
                state TEXT NOT NULL DEFAULT 'open',
                priority TEXT NOT NULL DEFAULT 'standard',
                preview TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        # ── GAP REMEDIATIONS ─────────────────────────────────────────
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS gap_remediations (
                id TEXT PRIMARY KEY,
                submission_id TEXT,
                document_id TEXT,
                agent_id TEXT NOT NULL,
                agent_name TEXT NOT NULL,
                agent_run_id TEXT,
                gap_text TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'major',
                framework TEXT,
                section_ref TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                owner_name TEXT NOT NULL DEFAULT 'Anika Sharma',
                owner_initials TEXT NOT NULL DEFAULT 'AS',
                due_date TEXT,
                resolution_note TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_remediations_submission
            ON gap_remediations(submission_id)
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_remediations_status
            ON gap_remediations(status)
        """)

        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_docs_submission "
            "ON documents(submission_id)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_corr_submission "
            "ON ha_correspondence(submission_id)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_subs_state "
            "ON submissions(state)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_subs_created "
            "ON submissions(created_at DESC)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_remediations_severity "
            "ON gap_remediations(severity, status)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_docs_created "
            "ON documents(created_at DESC)"
        )

        # Primary vault document record
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS vault_documents (
                id              TEXT PRIMARY KEY,
                workspace_id    TEXT NOT NULL DEFAULT '',
                doc_number      TEXT NOT NULL,
                title           TEXT NOT NULL,
                doc_type        TEXT NOT NULL DEFAULT 'Other',
                lifecycle_state TEXT NOT NULL DEFAULT 'draft',
                current_version TEXT NOT NULL DEFAULT '1.0',
                storage_path    TEXT NOT NULL,
                storage_bucket  TEXT NOT NULL,
                file_name       TEXT NOT NULL,
                file_size_bytes BIGINT NOT NULL DEFAULT 0,
                mime_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
                page_count      INTEGER,
                extracted_text  TEXT,
                owner_name      TEXT NOT NULL DEFAULT '',
                owner_initials  TEXT NOT NULL DEFAULT '',
                classification  TEXT NOT NULL DEFAULT 'Regulatory / General',
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_vault_documents_workspace_number UNIQUE (workspace_id, doc_number)
            )
        """)

        await conn.execute("""
            ALTER TABLE vault_documents
            ADD COLUMN IF NOT EXISTS workspace_id TEXT NOT NULL DEFAULT ''
        """)

        await conn.execute("""
            DO $$
            DECLARE
                constraint_name TEXT;
            BEGIN
                SELECT c.conname INTO constraint_name
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
                WHERE t.relname = 'vault_documents'
                  AND c.contype = 'u'
                  AND a.attname = 'doc_number'
                  AND array_length(c.conkey, 1) = 1
                LIMIT 1;

                IF constraint_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE vault_documents DROP CONSTRAINT %I', constraint_name);
                END IF;
            END $$;
        """)

        await conn.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'uq_vault_documents_workspace_number'
                ) THEN
                    ALTER TABLE vault_documents
                    ADD CONSTRAINT uq_vault_documents_workspace_number UNIQUE (workspace_id, doc_number);
                END IF;
            END $$;
        """)

        # Version history
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS vault_document_versions (
                id              TEXT PRIMARY KEY,
                document_id     TEXT NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
                version_number  TEXT NOT NULL,
                storage_path    TEXT NOT NULL,
                file_name       TEXT NOT NULL,
                file_size_bytes BIGINT NOT NULL DEFAULT 0,
                uploaded_by     TEXT NOT NULL DEFAULT '',
                upload_note     TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        # Audit trail
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS vault_document_audit (
                id          TEXT PRIMARY KEY,
                document_id TEXT NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
                action      TEXT NOT NULL,
                from_state  TEXT,
                to_state    TEXT,
                user_name   TEXT NOT NULL DEFAULT '',
                user_initials TEXT NOT NULL DEFAULT '',
                note        TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        # Compliance scan results
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS vault_compliance_scans (
                id              TEXT PRIMARY KEY,
                document_id     TEXT NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
                scan_type       TEXT NOT NULL DEFAULT 'completeness',
                status          TEXT NOT NULL DEFAULT 'pending',
                score           INTEGER,
                findings        JSONB NOT NULL DEFAULT '[]',
                agent_run_id    TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        # Vault indexes
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vault_docs_state "
            "ON vault_documents(lifecycle_state)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vault_docs_workspace "
            "ON vault_documents(workspace_id)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vault_versions_doc "
            "ON vault_document_versions(document_id)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vault_audit_doc "
            "ON vault_document_audit(document_id)"
        )
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vault_scans_doc "
            "ON vault_compliance_scans(document_id)"
        )

        print("All workspace tables ready.")
    finally:
        await conn.close()
