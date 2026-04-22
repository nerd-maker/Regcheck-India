import os
import json
import logging
import hashlib
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

CASE_COLLECTION_NAME = "sae_cases"
SIMILARITY_THRESHOLD = 0.85  # cases above this cosine similarity are flagged as duplicates

def get_case_collection():
    """Get or create the SAE cases ChromaDB collection."""
    try:
        import chromadb
        from chromadb.utils import embedding_functions
        
        chromadb_path = os.getenv("CHROMADB_PATH", "./data/chromadb")
        client = chromadb.PersistentClient(
            path=chromadb_path,
            settings=chromadb.Settings(anonymized_telemetry=False)
        )
        embedding_fn = embedding_functions.DefaultEmbeddingFunction()
        
        collection = client.get_or_create_collection(
            name=CASE_COLLECTION_NAME,
            embedding_function=embedding_fn,
            metadata={"hnsw:space": "cosine"}
        )
        return collection
    except Exception as e:
        logger.error(f"Failed to get case collection: {e}")
        return None


def search_similar_cases(case_text: str, n_results: int = 5) -> list[dict]:
    """Search for similar cases in the store. Returns list of matches above threshold."""
    try:
        collection = get_case_collection()
        if not collection:
            return []
        
        count = collection.count()
        if count == 0:
            return []
        
        actual_n = min(n_results, count)
        results = collection.query(
            query_texts=[case_text],
            n_results=actual_n
        )
        
        matches = []
        if results and results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                distance = results["distances"][0][i] if results.get("distances") else 1.0
                similarity = 1 - distance  # convert cosine distance to similarity
                
                if similarity >= SIMILARITY_THRESHOLD:
                    metadata = results["metadatas"][0][i] if results.get("metadatas") else {}
                    matches.append({
                        "case_id": metadata.get("case_id", "UNKNOWN"),
                        "similarity_score": round(similarity * 100, 1),
                        "submitted_at": metadata.get("submitted_at", ""),
                        "primary_category": metadata.get("primary_category", ""),
                        "study_drug": metadata.get("study_drug", ""),
                        "snippet": doc[:300] + "..." if len(doc) > 300 else doc
                    })
        
        return sorted(matches, key=lambda x: x["similarity_score"], reverse=True)
    
    except Exception as e:
        logger.error(f"Duplicate search failed: {e}")
        return []


def store_case(case_text: str, case_metadata: dict) -> bool:
    """Store a case in ChromaDB for future duplicate detection."""
    try:
        collection = get_case_collection()
        if not collection:
            return False
        
        # Generate unique case ID based on content hash + timestamp
        content_hash = hashlib.md5(case_text.encode()).hexdigest()[:8]
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        case_id = f"SAE-{timestamp}-{content_hash.upper()}"
        
        collection.add(
            documents=[case_text],
            ids=[case_id],
            metadatas=[{
                "case_id": case_id,
                "submitted_at": datetime.utcnow().isoformat(),
                "primary_category": case_metadata.get("primary_category", ""),
                "study_drug": case_metadata.get("study_drug", ""),
                "priority_score": str(case_metadata.get("priority_score", "")),
            }]
        )
        logger.info(f"Stored case {case_id} in ChromaDB")
        return True
    
    except Exception as e:
        logger.error(f"Failed to store case: {e}")
        return False
