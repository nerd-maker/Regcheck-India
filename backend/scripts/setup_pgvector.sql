-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Regulatory documents vector store
CREATE TABLE IF NOT EXISTS regulatory_embeddings (
    id          BIGSERIAL PRIMARY KEY,
    doc_name    TEXT NOT NULL,
    framework   TEXT NOT NULL,
    section     TEXT,
    page_number INTEGER,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    content     TEXT NOT NULL,
    embedding   vector(384),
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast similarity search
CREATE INDEX IF NOT EXISTS regulatory_embeddings_embedding_idx
    ON regulatory_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

-- Index for filtering by framework
CREATE INDEX IF NOT EXISTS regulatory_embeddings_framework_idx
    ON regulatory_embeddings (framework);
