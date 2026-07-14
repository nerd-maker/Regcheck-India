"""
Local TF-IDF RAG service.
Replaces pgvector + sentence-transformers with in-memory TF-IDF search.

Zero external dependencies beyond scikit-learn:
- No database connection needed
- No model downloads
- No network calls
- Starts in < 2 seconds
- Uses ~50MB RAM for full 14-document corpus

The regulatory_chunks.json file must exist at:
    backend/knowledge_base/regulatory_chunks.json

Run the preprocessing script once to generate it:
    cd backend && python scripts/preprocess_regulatory_docs.py
"""

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Path to pre-processed chunks file — relative to this file's location
CHUNKS_FILE = Path(__file__).parent.parent.parent / "knowledge_base" / "regulatory_chunks.json"


@lru_cache(maxsize=1)
def _load_chunks() -> list:
    """
    Load regulatory chunks from JSON file.
    Cached — loads once on first call, reused forever.
    Returns empty list if file not found (graceful degradation).
    """
    if not CHUNKS_FILE.exists():
        logger.warning(
            "regulatory_chunks.json not found at %s. "
            "RAG context will be unavailable. "
            "Run: python scripts/preprocess_regulatory_docs.py",
            CHUNKS_FILE,
        )
        return []

    try:
        with open(CHUNKS_FILE, "r", encoding="utf-8") as f:
            chunks = json.load(f)
        logger.info("Loaded %d regulatory chunks from %s", len(chunks), CHUNKS_FILE)
        return chunks
    except Exception as e:
        logger.error("Failed to load regulatory_chunks.json: %s", e)
        return []


@lru_cache(maxsize=1)
def _build_tfidf_index():
    """
    Build TF-IDF index from loaded chunks.
    Cached — built once on first query, reused forever.
    Returns (vectorizer, tfidf_matrix, chunks) tuple, or None if chunks empty.
    """
    chunks = _load_chunks()
    if not chunks:
        return None

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer

        contents = [c["content"] for c in chunks]

        vectorizer = TfidfVectorizer(
            max_features=20000,
            ngram_range=(1, 2),       # unigrams + bigrams for better matching
            stop_words="english",
            sublinear_tf=True,        # log normalization
            min_df=2,                 # ignore terms appearing in < 2 chunks
        )

        tfidf_matrix = vectorizer.fit_transform(contents)
        logger.info(
            "TF-IDF index built: %d chunks, %d features",
            tfidf_matrix.shape[0],
            tfidf_matrix.shape[1],
        )
        return vectorizer, tfidf_matrix, chunks

    except Exception as e:
        logger.error("Failed to build TF-IDF index: %s", e)
        return None


def retrieve_regulatory_context_local(
    query: str,
    n_results: int = 6,
    framework_filter: Optional[str] = None,
) -> list:
    """
    Retrieve relevant regulatory chunks for a query using TF-IDF similarity.

    Returns list of dicts with keys:
        content, doc_name, framework, short_name, authority,
        page_number, similarity

    Returns empty list if index not available (graceful degradation).
    """
    index = _build_tfidf_index()
    if index is None:
        return []

    vectorizer, tfidf_matrix, chunks = index

    try:
        from sklearn.metrics.pairwise import cosine_similarity
        import numpy as np

        # Transform query using fitted vectorizer
        query_vec = vectorizer.transform([query])

        # Filter by framework if specified
        if framework_filter:
            filtered_indices = [
                i for i, c in enumerate(chunks)
                if c.get("framework") == framework_filter
            ]
            if not filtered_indices:
                filtered_indices = list(range(len(chunks)))
            search_matrix = tfidf_matrix[filtered_indices]
            scores = cosine_similarity(query_vec, search_matrix).flatten()
            top_local_indices = np.argsort(scores)[::-1][:n_results]
            top_indices = [filtered_indices[i] for i in top_local_indices]
            top_scores = scores[top_local_indices]
        else:
            scores = cosine_similarity(query_vec, tfidf_matrix).flatten()
            top_indices = np.argsort(scores)[::-1][:n_results]
            top_scores = scores[top_indices]

        results = []
        for idx, score in zip(top_indices, top_scores):
            if score < 0.01:  # skip near-zero similarity results
                continue
            chunk = chunks[idx]
            results.append({
                "content": chunk["content"],
                "doc_name": chunk["doc_name"],
                "framework": chunk["framework"],
                "short_name": chunk["short_name"],
                "authority": chunk["authority"],
                "page_number": chunk["page_number"],
                "similarity": float(score),
            })

        return results

    except Exception as e:
        logger.error("TF-IDF retrieval failed: %s", e)
        return []


def get_corpus_stats() -> dict:
    """Return stats about the loaded corpus — used for health checks and startup logging."""
    chunks = _load_chunks()
    if not chunks:
        return {"status": "unavailable", "total_chunks": 0, "documents": []}

    from collections import Counter
    doc_counts = Counter(c["short_name"] for c in chunks)

    return {
        "status": "ready",
        "total_chunks": len(chunks),
        "documents": [
            {"short_name": name, "chunk_count": count}
            for name, count in sorted(doc_counts.items())
        ],
    }
