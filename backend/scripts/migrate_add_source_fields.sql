-- Migration: Add source tracking fields to regulatory_embeddings
-- Run once in Supabase SQL Editor before deploying Sprint 6.
-- Safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS guards).

-- Add source tracking fields to existing regulatory_embeddings table
ALTER TABLE regulatory_embeddings
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS publication_date DATE,
    ADD COLUMN IF NOT EXISTS is_scraped BOOLEAN DEFAULT FALSE;

-- Queue table for scraped documents awaiting human approval
CREATE TABLE IF NOT EXISTS regulatory_updates_queue (
    id               BIGSERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    source_url       TEXT NOT NULL UNIQUE,
    authority        TEXT NOT NULL,
    framework        TEXT,
    document_type    TEXT NOT NULL,
    -- Types: circular | guidance | order | notification | amendment | newsletter
    publication_date DATE,
    summary          TEXT,
    -- AI-generated 2-3 sentence summary of what this document contains
    extracted_text   TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending_review',
    -- Statuses: pending_review | approved | rejected | ingesting | ingested | failed
    scraped_at       TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at      TIMESTAMPTZ,
    reviewed_by      TEXT,
    rejection_reason TEXT,
    chunk_count      INTEGER,
    -- Set after successful ingestion
    error_message    TEXT
    -- Set if ingestion failed
);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS regulatory_updates_queue_status_idx
    ON regulatory_updates_queue (status);

-- Unique index for deduplication by URL
CREATE UNIQUE INDEX IF NOT EXISTS regulatory_updates_queue_url_idx
    ON regulatory_updates_queue (source_url);
