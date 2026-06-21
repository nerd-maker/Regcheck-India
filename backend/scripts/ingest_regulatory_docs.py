"""
Regulatory document ingestion script for pgvector.
Run once: python scripts/ingest_regulatory_docs.py

Loads all documents from knowledge_base/documents/ into Supabase pgvector.
Safe to re-run — clears existing embeddings before re-ingesting.
"""
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional
import PyPDF2
import asyncpg

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Document metadata — maps filename to framework, display name, and other metadata fields
DOCUMENT_REGISTRY = {
    "NEW DRUGS ANDctrS RULE, 2019.PDF": {
        "framework": "NDCTR 2019",
        "doc_name": "NDCTR 2019",
        "title": "New Drugs and Clinical Trials Rules 2019",
        "short_name": "NDCTR 2019",
        "category": "Indian Regulation",
        "authority": "CDSCO",
    },
    "Clinical (1).pdf": {
        "framework": "ICH E6(R3) GCP",
        "doc_name": "CDSCO GCP Guidelines",
        "title": "CDSCO Good Clinical Practice Guidelines",
        "short_name": "CDSCO GCP",
        "category": "Indian Regulation",
        "authority": "CDSCO",
    },
    "ICMR_National_Ethical_Guidelines.pdf": {
        "framework": "Schedule Y",
        "doc_name": "ICMR Guidelines",
        "title": "ICMR National Ethical Guidelines for Biomedical Research",
        "short_name": "ICMR Guidelines",
        "category": "Indian Regulation",
        "authority": "ICMR",
    },
    "E2A_Guideline.pdf": {
        "framework": "ICH E2A",
        "doc_name": "ICH E2A Guidelines",
        "title": "ICH E2A Clinical Safety Data Management",
        "short_name": "ICH E2A",
        "category": "ICH Guideline",
        "authority": "ICH",
    },
    "ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf": {
        "framework": "ICH E6(R3) GCP",
        "doc_name": "ICH E6(R3) Guidelines",
        "title": "ICH E6(R3) Good Clinical Practice",
        "short_name": "ICH E6(R3)",
        "category": "ICH Guideline",
        "authority": "ICH",
    },
    "Clinical.pdf": {
        "framework": "Schedule Y",
        "doc_name": "Schedule Y Guidelines",
        "title": "Schedule Y - Drugs and Cosmetics Act",
        "short_name": "Schedule Y",
        "category": "Indian Regulation",
        "authority": "CDSCO",
    },
}

# Chunking config — same as existing ChromaDB setup
CHUNK_SIZE = 500      # words per chunk
CHUNK_OVERLAP = 50    # word overlap between chunks


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        if len(chunk.strip()) > 50:  # skip tiny chunks
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


async def ingest_all_documents():
    from app.core.config import get_settings
    from sentence_transformers import SentenceTransformer

    settings = get_settings()
    db_url = settings.safe_supabase_db_url or settings.database_url
    if not db_url:
        logger.error("No database connection string configured in Settings.")
        return

    docs_dir = Path(__file__).parent.parent / "knowledge_base" / "documents"

    logger.info("Loading embedding model...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("Model loaded")

    conn = await asyncpg.connect(db_url, timeout=10.0, statement_cache_size=0)

    try:
        # Clear existing embeddings
        deleted = await conn.fetchval("DELETE FROM regulatory_embeddings RETURNING COUNT(*)")
        logger.info(f"Cleared {deleted or 0} existing embeddings")

        total_chunks = 0

        for filename, meta in DOCUMENT_REGISTRY.items():
            filepath = docs_dir / filename
            # Fallback to alternative case extensions for Linux environment support
            if not filepath.exists():
                if filename.endswith(".pdf"):
                    filepath = docs_dir / filename.replace(".pdf", ".PDF")
                elif filename.endswith(".PDF"):
                    filepath = docs_dir / filename.replace(".PDF", ".pdf")

            if not filepath.exists():
                logger.warning(f"SKIPPING (not found): {filename} in {docs_dir}")
                continue

            logger.info(f"Loading: {meta['doc_name']}")

            # Extract text page by page
            text_parts = []
            try:
                with open(filepath, "rb") as f:
                    reader = PyPDF2.PdfReader(f)
                    for page_num, page in enumerate(reader.pages, 1):
                        page_text = page.extract_text()
                        if page_text:
                            text_parts.append((page_text.strip(), page_num))
            except Exception as e:
                logger.error(f"Failed to read PDF {filepath}: {e}")
                continue

            logger.info(f"  Pages: {len(text_parts)}")

            # Chunk per page to preserve page number metadata
            all_chunks = []
            for page_text, page_num in text_parts:
                page_chunks = chunk_text(page_text)
                for chunk in page_chunks:
                    all_chunks.append((chunk, page_num))

            logger.info(f"  Chunks: {len(all_chunks)}")

            # Embed in batches of 32
            batch_size = 32
            for batch_start in range(0, len(all_chunks), batch_size):
                batch = all_chunks[batch_start:batch_start + batch_size]
                texts = [c[0] for c in batch]
                page_nums = [c[1] for c in batch]

                embeddings = model.encode(texts, normalize_embeddings=True)

                # Insert batch
                for i, (text, page_num, embedding) in enumerate(
                    zip(texts, page_nums, embeddings)
                ):
                    embedding_str = "[" + ",".join(str(x) for x in embedding.tolist()) + "]"
                    
                    # Store all metadata properties inside the JSONB metadata column
                    metadata_dict = {
                        "title": meta["title"],
                        "short_name": meta["short_name"],
                        "category": meta["category"],
                        "authority": meta["authority"],
                        "citation": meta.get("citation", ""),
                    }
                    metadata_str = json.dumps(metadata_dict)
                    
                    await conn.execute("""
                        INSERT INTO regulatory_embeddings
                            (doc_name, framework, section, page_number, chunk_index, content, embedding, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb)
                    """,
                        meta["doc_name"],
                        meta["framework"],
                        "",  # section
                        page_num,
                        batch_start + i,
                        text,
                        embedding_str,
                        metadata_str,
                    )

                total_chunks += len(batch)
                logger.info(f"  Ingested {min(batch_start + batch_size, len(all_chunks))}/{len(all_chunks)} chunks")

            logger.info(f"  Done: {meta['doc_name']}")

        logger.info(f"\nIngestion complete. Total chunks: {total_chunks}")
        count = await conn.fetchval("SELECT COUNT(*) FROM regulatory_embeddings")
        logger.info(f"Verified: {count} rows in regulatory_embeddings table")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(ingest_all_documents())


async def ingest_single_document(
    conn: asyncpg.Connection,
    doc_name: str,
    framework: str,
    extracted_text: str,
    source_url: Optional[str] = None,
    publication_date: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> int:
    """
    Ingest a single document into regulatory_embeddings.
    Used when a human approves a queued scraped document.

    NEVER deletes existing embeddings — additive only.
    Returns the number of chunks inserted.
    """
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
    chunks = chunk_text(extracted_text)
    if not chunks:
        return 0

    batch_size = 32
    total_inserted = 0

    for batch_start in range(0, len(chunks), batch_size):
        batch = chunks[batch_start : batch_start + batch_size]
        embeddings = model.encode(batch, normalize_embeddings=True)

        for i, (chunk, embedding) in enumerate(zip(batch, embeddings)):
            embedding_str = "[" + ",".join(str(x) for x in embedding.tolist()) + "]"
            await conn.execute(
                """
                INSERT INTO regulatory_embeddings
                    (doc_name, framework, section, page_number, chunk_index,
                     content, embedding, source_url, publication_date,
                     is_scraped, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7::vector,
                        $8, $9::date, $10, $11::jsonb)
                """,
                doc_name,
                framework,
                "",  # section — not available for scraped docs
                0,   # page_number — not tracked for scraped docs
                batch_start + i,
                chunk,
                embedding_str,
                source_url,
                publication_date,
                source_url is not None,  # is_scraped = True when from scraper
                json.dumps(metadata or {}),
            )
            total_inserted += 1

    return total_inserted
