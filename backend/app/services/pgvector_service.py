"""
pgvector_service.py — DEPRECATED

This module previously handled sentence-transformer embeddings and pgvector
queries for regulatory RAG context. It has been replaced by the local TF-IDF
approach in app/services/local_rag_service.py.

Kept as a stub to avoid import errors from knowledge_base.py which imports
embed_text and get_embedding_model. Those callers are also deprecated but not
yet removed.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)
logger.warning(
    "pgvector_service is deprecated. "
    "Use app.services.local_rag_service instead. "
    "sentence-transformers and pgvector are no longer in the critical path."
)


async def get_embedding_model():
    """Deprecated stub — sentence-transformers no longer used."""
    logger.warning("get_embedding_model() called on deprecated pgvector_service stub")
    return None


def embed_text(text: str) -> list:
    """Deprecated stub — local TF-IDF does not require explicit embeddings."""
    logger.warning("embed_text() called on deprecated pgvector_service stub")
    return []


async def retrieve_regulatory_context(
    query: str,
    n_results: int = 6,
    framework_filter: Optional[str] = None,
) -> list:
    """
    Deprecated stub — delegates to local_rag_service.
    Kept for backward compatibility with any code that imports this directly.
    """
    try:
        from app.services.local_rag_service import retrieve_regulatory_context_local
        return retrieve_regulatory_context_local(query=query, n_results=n_results, framework_filter=framework_filter)
    except Exception as e:
        logger.error("pgvector_service stub delegation failed: %s", e)
        return []
