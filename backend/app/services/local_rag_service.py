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



# ---------------------------------------------------------------------------
# Query expansion — regulatory synonym mapping
# ---------------------------------------------------------------------------
# Maps abbreviated or user-facing terms to the exact vocabulary used in the
# regulatory documents. TF-IDF is a bag-of-words model, so bridging the
# vocabulary gap between queries and documents dramatically improves recall.
REGULATORY_SYNONYMS: dict[str, str] = {
    "susar": "suspected unexpected serious adverse reaction expedited reporting 7-day 15-day",
    "sar": "serious adverse reaction unexpected fatal life-threatening",
    "ae": "adverse event adverse reaction safety reporting",
    "susar reporting": "expedited reporting fatal unexpected serious adverse reaction 7 day 15 day",
    "paediatric": "pediatric children below 18 years age group",
    "cdsco": "central drugs standard control organisation dcgi india regulatory",
    "schedule y": "ndctr 2019 clinical trial india new drugs",
    "gcp": "good clinical practice ich e6 r3 investigator sponsor",
    "informed consent": "icf consent form subject participant",
    "sae": "serious adverse event life-threatening hospitalization disability",
    "icf": "informed consent form subject participant written consent",
    "ctd": "common technical document regulatory submission dossier",
    "dsmb": "data safety monitoring board independent safety committee",
    "irb": "institutional review board ethics committee iec",
    "iec": "independent ethics committee irb institutional review board",
    "pii": "personally identifiable information personal data patient identifiers",
    "phi": "protected health information personal health data patient records",
    "dpdp": "digital personal data protection act 2023 india privacy",
    "ndctr": "new drugs clinical trials rules 2019 india cdsco",
    "ich e2a": "expedited reporting serious unexpected adverse reactions susar timelines",
    "ich e6": "good clinical practice gcp investigator sponsor monitoring",
    "pharmacovigilance": "adverse event reporting safety surveillance signal detection",
    "aefi": "adverse event following immunisation vaccine safety reporting",
    # Indian regulatory specific
    "dcgi": "drugs controller general india cdsco central drugs standard control",
    "sugam": "online submission portal cdsco drug approval application",
    "form 44": "clinical trial application permission new drug india cdsco",
    "ct permission": "clinical trial permission form 44 cdsco new drug",
    "schedule m": "good manufacturing practices gmp india pharmaceutical",
    "ndct rules": "new drugs clinical trials rules 2019 ndctr india",
    "ctri": "clinical trials registry india registration mandatory",
    "ethics committee": "iec irb institutional ethics committee approval",
    "sla": "state licensing authority drug controller state",
    "mah": "marketing authorisation holder drug licence holder india",
    "nda": "new drug application marketing approval india cdsco",
    "anda": "abbreviated new drug application generic drug india",
    "ba/be": "bioavailability bioequivalence study india schedule y",
    "pharmacopoeia": "ip indian pharmacopoeia usp bp standard specification",
    "gcp inspection": "cdsco inspection good clinical practice audit findings",
    "who umc": "world health organisation causality assessment scale terminology",
    "ich e2b": "electronic transmission individual case safety reports icsrs",
    "psur": "periodic safety update report pharmacovigilance",
    "rmp": "risk management plan pharmacovigilance safety",
    "signal detection": "pharmacovigilance safety signal adverse event monitoring",
    "investigator brochure": "ib preclinical clinical information investigational product",
    "protocol deviation": "protocol violation gcp non-compliance clinical trial",
    "capa": "corrective action preventive action audit finding inspection",
}


def expand_query(query: str) -> str:
    """Expand a query with regulatory synonyms to improve TF-IDF recall.

    TF-IDF matches exact vocabulary — user queries use abbreviations (SUSAR,
    GCP, SAE) while regulatory documents use full terms. This bridges the gap
    by appending synonym expansions to the original query text.

    Examples:
        "SUSAR reporting timeline" →
        "SUSAR reporting timeline suspected unexpected serious adverse reaction
         expedited reporting 7-day 15-day"

    The original query is always preserved, so precision is not harmed when
    the query already uses document vocabulary.
    """
    query_lower = query.lower()
    additions: list[str] = []
    for term, synonyms in REGULATORY_SYNONYMS.items():
        if term in query_lower:
            additions.append(synonyms)
    if additions:
        return query + " " + " ".join(additions)
    return query


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

        # Expand query with regulatory synonyms before vectorizing
        query_vec = vectorizer.transform([expand_query(query)])

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
