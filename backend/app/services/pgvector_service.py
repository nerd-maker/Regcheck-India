import asyncio
import json
import logging
from functools import lru_cache
from typing import Optional
import asyncpg
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Lazy-loaded embedding model — only initialised on first use
_embedding_model = None
_model_lock = asyncio.Lock()


async def get_embedding_model():
    """
    Lazy-load the sentence-transformer model.
    Only loads on first RAG query — not at startup.
    This keeps Render memory under 512MB at boot.
    """
    global _embedding_model
    if _embedding_model is None:
        async with _model_lock:
            if _embedding_model is None:
                from sentence_transformers import SentenceTransformer
                logger.info("Loading embedding model all-MiniLM-L6-v2 (first RAG query)")
                _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("Embedding model loaded successfully")
    return _embedding_model


def embed_text(text: str) -> list[float]:
    """
    Synchronous embedding — call from sync context or wrap in executor.
    Returns 384-dimensional vector.
    """
    if _embedding_model is None:
        raise RuntimeError("Embedding model not loaded. Call get_embedding_model() first.")
    return _embedding_model.encode(text, normalize_embeddings=True).tolist()


async def retrieve_regulatory_context(
    query: str,
    n_results: int = 6,
    framework_filter: Optional[str] = None,
) -> list[dict]:
    """
    Query pgvector for relevant regulatory context.
    Returns list of dicts.
    
    This is a drop-in replacement for the ChromaDB retrieve_regulatory_context().
    """
    settings = get_settings()
    # Fallback to database_url if supabase_db_url is empty
    db_url = settings.supabase_db_url or settings.database_url
    if not db_url:
        logger.error("No database connection string configured for pgvector")
        return []
    
    try:
        # Ensure model is loaded
        await get_embedding_model()
        
        # Generate query embedding in thread pool (CPU-bound)
        loop = asyncio.get_event_loop()
        query_embedding = await loop.run_in_executor(None, embed_text, query)
        
        # Format as pgvector literal
        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
        
        conn = await asyncpg.connect(db_url, timeout=10.0, statement_cache_size=0)
        try:
            if framework_filter:
                rows = await conn.fetch("""
                    SELECT
                        content,
                        doc_name,
                        framework,
                        section,
                        page_number,
                        metadata,
                        source_url,
                        publication_date::text AS publication_date,
                        is_scraped,
                        1 - (embedding <=> $1::vector) AS similarity
                    FROM regulatory_embeddings
                    WHERE framework = $2
                    ORDER BY embedding <=> $1::vector
                    LIMIT $3
                """, embedding_str, framework_filter, n_results)
            else:
                rows = await conn.fetch("""
                    SELECT
                        content,
                        doc_name,
                        framework,
                        section,
                        page_number,
                        metadata,
                        source_url,
                        publication_date::text AS publication_date,
                        is_scraped,
                        1 - (embedding <=> $1::vector) AS similarity
                    FROM regulatory_embeddings
                    ORDER BY embedding <=> $1::vector
                    LIMIT $2
                """, embedding_str, n_results)
        finally:
            await conn.close()
        
        results = []
        for r in rows:
            meta = r["metadata"]
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            elif meta is None:
                meta = {}
                
            results.append({
                "content": r["content"],
                "doc_name": r["doc_name"],
                "framework": r["framework"],
                "section": r["section"] or "",
                "page_number": r["page_number"] or 0,
                "similarity": float(r["similarity"]),
                "short_name": meta.get("short_name", ""),
                "title": meta.get("title", ""),
                "category": meta.get("category", ""),
                "authority": meta.get("authority", ""),
                "citation": meta.get("citation", ""),
                "metadata": meta,
                "source_url": r["source_url"],
                "publication_date": r["publication_date"],
                "is_scraped": r["is_scraped"] or False,
            })
            
        logger.info(
            "pgvector_query_success: query_preview=%s, n_results=%d, framework=%s",
            query[:50],
            len(results),
            framework_filter,
        )
        return results
        
    except Exception as e:
        logger.error("pgvector_query_failed: %s", e, exc_info=True)
        return []  # Graceful fallback — agents work without RAG context
