"""
RAG (Retrieval-Augmented Generation) pipeline for regulatory compliance.
"""
from typing import Dict, List, Optional
from app.services.knowledge_base import knowledge_base
from app.core.config import settings


class RAGPipeline:
    """Retrieve relevant regulatory context for document evaluation."""
    
    def __init__(self):
        self.kb = knowledge_base
        self.top_k = settings.rag_top_k
        self.similarity_threshold = settings.rag_similarity_threshold
    
    def retrieve_context(
        self,
        document_type: str,
        document_content: str,
        sections: List[tuple],
        metadata: Dict
    ) -> Dict[str, any]:
        """
        Retrieve relevant regulatory context for a document.
        
        NOW WITH QUALITY CHECKS:
        - Blocks retrieval if similarity < 0.65
        - Warns if similarity 0.65-0.74
        - Only proceeds with quality retrievals
        
        Args:
            document_type: Type of document being evaluated
            document_content: Full document text
            sections: List of (heading, content) tuples
            metadata: Document metadata
            
        Returns:
            Dictionary containing:
                - retrieved_chunks: List of relevant regulatory chunks
                - context_summary: Summary of retrieved context
                - quality_flag: PASS/WARNING/FAIL
                - should_proceed: bool
        """
        from app.utils.retrieval_quality import retrieve_with_quality_check, format_context_with_citations
        
        # Build query from document type and key sections
        query_components = [
            f"Document type: {document_type}",
            f"Content preview: {document_content[:500]}"
        ]
        
        # Add important section headings
        if sections:
            section_headings = [heading for heading, _ in sections[:5]]
            query_components.append(f"Sections: {', '.join(section_headings)}")
        
        query_text = '\n'.join(query_components)
        
        # Retrieve with quality check
        retrieval_result = retrieve_with_quality_check(
            chroma_collection=self.kb.collection,
            query=query_text,
            top_k=self.top_k,
            min_similarity=0.65,  # Minimum threshold
            jurisdiction_filter="India"
        )
        
        # Check if retrieval quality is sufficient
        if not retrieval_result["should_proceed"]:
            # BLOCKED: Low quality retrieval
            return {
                'retrieved_chunks': [],
                'context_summary': retrieval_result["reason"],
                'total_chunks': 0,
                'quality_flag': retrieval_result["quality_flag"],
                'should_proceed': False,
                'max_similarity': retrieval_result["max_similarity"],
                'blocked_reason': retrieval_result["reason"]
            }
        
        # Process and format results
        retrieved_chunks = []
        
        if retrieval_result['chunks'] and retrieval_result['metadatas']:
            for i, (doc, metadata_item) in enumerate(zip(
                retrieval_result['chunks'],
                retrieval_result['metadatas']
            )):
                similarity = retrieval_result['similarities'][i] if 'similarities' in retrieval_result else 0.0
                
                chunk = {
                    'rank': i + 1,
                    'text': doc,
                    'source': metadata_item.get('source_doc', 'Unknown'),
                    'citation': metadata_item.get('citation_format', 'No citation'),
                    'section': metadata_item.get('section', ''),
                    'version': metadata_item.get('version', ''),
                    'document_type': metadata_item.get('document_type', 'general'),
                    'similarity_score': round(similarity, 3)
                }
                retrieved_chunks.append(chunk)
        
        # Create context summary
        context_summary = self._create_context_summary(retrieved_chunks)
        
        return {
            'retrieved_chunks': retrieved_chunks,
            'context_summary': context_summary,
            'total_chunks': len(retrieved_chunks),
            'quality_flag': retrieval_result["quality_flag"],
            'should_proceed': True,
            'max_similarity': retrieval_result["max_similarity"]
        }
    
    def _create_context_summary(self, chunks: List[Dict]) -> str:
        """Create a summary of retrieved context."""
        if not chunks:
            return "No relevant regulatory context found in knowledge base."
        
        sources = set(chunk['source'] for chunk in chunks)
        
        summary = f"Retrieved {len(chunks)} relevant regulatory chunks from {len(sources)} sources:\n"
        for source in sorted(sources):
            source_chunks = [c for c in chunks if c['source'] == source]
            summary += f"- {source}: {len(source_chunks)} chunks\n"
        
        return summary
    
    def build_claude_context(self, retrieved_chunks: List[Dict]) -> str:
        """
        Build formatted context string for Claude prompt.
        
        Args:
            retrieved_chunks: List of retrieved regulatory chunks
            
        Returns:
            Formatted context string with citations
        """
        if not retrieved_chunks:
            return "NO REGULATORY CONTEXT RETRIEVED - EVALUATION MAY BE LIMITED"
        
        context_parts = ["=== RETRIEVED REGULATORY CONTEXT ===\n"]
        
        for chunk in retrieved_chunks:
            context_parts.append(f"\n--- Chunk {chunk['rank']} ---")
            context_parts.append(f"Source: {chunk['source']}")
            context_parts.append(f"Citation: {chunk['citation']}")
            context_parts.append(f"Relevance Score: {chunk['similarity_score']}")
            context_parts.append(f"\nContent:\n{chunk['text']}")
            context_parts.append("\n" + "-" * 80)
        
        return '\n'.join(context_parts)


# Global RAG pipeline instance
rag_pipeline = RAGPipeline()
