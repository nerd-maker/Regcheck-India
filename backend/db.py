# backend/db.py
# Shared DB helpers — all routers import from here

import os
import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL")


async def get_conn():
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Add it to your Render environment variables."
        )
    return await asyncpg.connect(DATABASE_URL)


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

        # Indexes
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

        print("All workspace tables ready.")
    finally:
        await conn.close()
