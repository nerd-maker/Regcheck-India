"""
Retrieval Quality Checker

Ensures RAG retrieval quality before allowing LLM to generate compliance findings.
Blocks low-quality retrievals to prevent hallucinations.
"""

from typing import Dict, List, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class RetrievalQuality(str, Enum):
    """Retrieval quality levels"""
    PASS = "PASS"           # Similarity >= 0.75
    WARNING = "WARNING"     # Similarity 0.65-0.74
    FAIL = "FAIL"           # Similarity < 0.65


def retrieve_with_quality_check(
    chroma_collection,
    query: str,
    top_k: int = 5,
    min_similarity: float = 0.65,
    jurisdiction_filter: str = "India"
) -> Dict:
    """
    Retrieve regulatory context with quality checks
    
    Args:
        chroma_collection: ChromaDB collection
        query: Query text
        top_k: Number of results to retrieve
        min_similarity: Minimum similarity threshold (default 0.65)
        jurisdiction_filter: Filter by jurisdiction (default "India")
        
    Returns:
        Dictionary with:
        - chunks: Retrieved text chunks
        - metadatas: Chunk metadata for citations
        - quality_flag: PASS/WARNING/FAIL
        - should_proceed: bool
        - max_similarity: Highest similarity score
        - reason: Explanation if blocked
    """
    
    # Build where filter
    where_filter = {"jurisdiction": jurisdiction_filter} if jurisdiction_filter else None
    
    try:
        # Query ChromaDB
        results = chroma_collection.query(
            query_texts=[query],
            n_results=top_k,
            where=where_filter,
            include=['documents', 'metadatas', 'distances']
        )
        
        # Check if any results returned
        if not results or not results['documents'] or not results['documents'][0]:
            logger.warning(f"No results returned for query: {query[:100]}")
            return {
                "chunks": [],
                "metadatas": [],
                "quality_flag": RetrievalQuality.FAIL,
                "should_proceed": False,
                "max_similarity": 0.0,
                "reason": "[CONTEXT NOT FOUND — FLAG FOR HUMAN REVIEW] No regulatory context found in knowledge base"
            }
        
        # Calculate similarity scores (ChromaDB returns distances, convert to similarity)
        distances = results['distances'][0]
        similarities = [1 - d for d in distances]
        max_similarity = max(similarities) if similarities else 0.0
        
        # Quality assessment based on max similarity
        if max_similarity < min_similarity:
            # FAIL: Block evaluation
            logger.warning(
                f"Low retrieval quality: max_similarity={max_similarity:.3f} < {min_similarity}"
            )
            return {
                "chunks": [],
                "metadatas": [],
                "quality_flag": RetrievalQuality.FAIL,
                "should_proceed": False,
                "max_similarity": max_similarity,
                "reason": f"[CONTEXT NOT FOUND — FLAG FOR HUMAN REVIEW] Retrieval quality too low (similarity={max_similarity:.3f})"
            }
        
        elif max_similarity < 0.75:
            # WARNING: Proceed but flag
            logger.info(
                f"Medium retrieval quality: max_similarity={max_similarity:.3f}"
            )
            return {
                "chunks": results['documents'][0],
                "metadatas": results['metadatas'][0],
                "quality_flag": RetrievalQuality.WARNING,
                "should_proceed": True,
                "max_similarity": max_similarity,
                "reason": "Low-medium similarity - review recommended",
                "similarities": similarities
            }
        
        else:
            # PASS: High quality
            logger.info(
                f"High retrieval quality: max_similarity={max_similarity:.3f}"
            )
            return {
                "chunks": results['documents'][0],
                "metadatas": results['metadatas'][0],
                "quality_flag": RetrievalQuality.PASS,
                "should_proceed": True,
                "max_similarity": max_similarity,
                "similarities": similarities
            }
    
    except Exception as e:
        logger.error(f"Error in retrieval quality check: {e}")
        return {
            "chunks": [],
            "metadatas": [],
            "quality_flag": RetrievalQuality.FAIL,
            "should_proceed": False,
            "max_similarity": 0.0,
            "reason": f"[RETRIEVAL ERROR — FLAG FOR HUMAN REVIEW] {str(e)}"
        }


def format_context_with_citations(chunks: List[str], metadatas: List[Dict]) -> str:
    """
    Format retrieved chunks with citation metadata
    
    Args:
        chunks: List of text chunks
        metadatas: List of metadata dicts
        
    Returns:
        Formatted context string with citations
    """
    
    if not chunks or not metadatas:
        return ""
    
    formatted_context = "RETRIEVED REGULATORY CONTEXT:\n\n"
    
    for i, (chunk, metadata) in enumerate(zip(chunks, metadatas), 1):
        citation = metadata.get('citation_format', '[SOURCE: Unknown]')
        source_doc = metadata.get('source_doc', 'Unknown')
        section = metadata.get('section', '')
        version = metadata.get('version', '')
        
        formatted_context += f"--- Context {i} ---\n"
        formatted_context += f"Source: {source_doc}\n"
        formatted_context += f"Section: {section}\n"
        formatted_context += f"Version: {version}\n"
        formatted_context += f"Citation: {citation}\n\n"
        formatted_context += f"{chunk}\n\n"
    
    return formatted_context


def validate_citations_in_response(response_text: str, retrieved_metadatas: List[Dict]) -> Dict:
    """
    Validate that all citations in LLM response match retrieved sources
    
    Args:
        response_text: LLM response text
        retrieved_metadatas: Metadata from retrieved chunks
        
    Returns:
        Validation result with any invalid citations
    """
    
    import re
    
    # Extract citations from response
    citation_pattern = r'\[SOURCE:\s*([^\]]+)\]'
    found_citations = re.findall(citation_pattern, response_text)
    
    # Build valid citation set from metadata
    valid_citations = set()
    for metadata in retrieved_metadatas:
        citation = metadata.get('citation_format', '')
        if citation:
            # Extract just the source part
            citation_match = re.search(r'\[SOURCE:\s*([^\]]+)\]', citation)
            if citation_match:
                valid_citations.add(citation_match.group(1).strip())
    
    # Check for invalid citations
    invalid_citations = []
    for citation in found_citations:
        citation_clean = citation.strip()
        if citation_clean not in valid_citations and citation_clean != "NOT FOUND IN RETRIEVED CONTEXT — FLAG FOR HUMAN REVIEW":
            invalid_citations.append(citation)
    
    return {
        "valid": len(invalid_citations) == 0,
        "total_citations": len(found_citations),
        "invalid_citations": invalid_citations,
        "valid_citation_sources": list(valid_citations)
    }


# Example usage
if __name__ == "__main__":
    from chromadb import Client
    
    # Initialize ChromaDB client
    client = Client()
    collection = client.get_or_create_collection("regulatory_knowledge")
    
    # Example retrieval with quality check
    result = retrieve_with_quality_check(
        chroma_collection=collection,
        query="What are the requirements for informed consent in clinical trials?",
        top_k=5,
        min_similarity=0.65
    )
    
    print(f"\nRetrieval Quality: {result['quality_flag']}")
    print(f"Max Similarity: {result['max_similarity']:.3f}")
    print(f"Should Proceed: {result['should_proceed']}")
    
    if result['should_proceed']:
        print(f"\nRetrieved {len(result['chunks'])} chunks")
        context = format_context_with_citations(result['chunks'], result['metadatas'])
        print(context[:500] + "...")
    else:
        print(f"\nBlocked: {result['reason']}")
