"""
Regulatory knowledge base management using ChromaDB.
"""
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Optional
from pathlib import Path
import json

from app.core.config import settings


class KnowledgeBase:
    """Manage regulatory knowledge base with ChromaDB."""
    
    def __init__(self):
        """Initialize ChromaDB client and collection."""
        # Create ChromaDB directory if it doesn't exist
        Path(settings.chromadb_path).mkdir(parents=True, exist_ok=True)
        
        # Initialize ChromaDB client
        self.client = chromadb.PersistentClient(
            path=settings.chromadb_path,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=settings.chromadb_collection_name,
            metadata={"description": "Indian pharmaceutical regulatory requirements"}
        )
    
    def add_regulatory_document(
        self,
        document_id: str,
        text: str,
        source: str,
        citation: str,
        document_type: str,
        metadata: Optional[Dict] = None
    ) -> None:
        """
        Add a regulatory document chunk to the knowledge base.
        
        Args:
            document_id: Unique identifier for the chunk
            text: The regulatory text content
            source: Source document (e.g., "NDCTR 2019")
            citation: Specific citation (e.g., "Rule 22(b)")
            document_type: Type of regulation
            metadata: Additional metadata
        """
        chunk_metadata = {
            "source": source,
            "citation": citation,
            "document_type": document_type,
            **(metadata or {})
        }
        
        self.collection.add(
            documents=[text],
            metadatas=[chunk_metadata],
            ids=[document_id]
        )
    
    def add_bulk_documents(self, documents: List[Dict]) -> None:
        """
        Add multiple regulatory documents at once.
        
        Args:
            documents: List of dicts with keys: id, text, source, citation, document_type, metadata
        """
        ids = [doc['id'] for doc in documents]
        texts = [doc['text'] for doc in documents]
        metadatas = [
            {
                "source": doc['source'],
                "citation": doc['citation'],
                "document_type": doc.get('document_type', 'general'),
                **doc.get('metadata', {})
            }
            for doc in documents
        ]
        
        self.collection.add(
            documents=texts,
            metadatas=metadatas,
            ids=ids
        )
    
    def query(
        self,
        query_text: str,
        n_results: int = 10,
        document_type_filter: Optional[str] = None
    ) -> Dict:
        """
        Query the knowledge base for relevant regulatory content.
        
        Args:
            query_text: The query text
            n_results: Number of results to return
            document_type_filter: Optional filter by document type
            
        Returns:
            Dictionary with documents, metadatas, and distances
        """
        where_filter = None
        if document_type_filter:
            where_filter = {"document_type": document_type_filter}
        
        results = self.collection.query(
            query_texts=[query_text],
            n_results=n_results,
            where=where_filter
        )
        
        return results
    
    def get_collection_stats(self) -> Dict:
        """Get statistics about the knowledge base."""
        count = self.collection.count()
        
        return {
            "total_documents": count,
            "collection_name": settings.chromadb_collection_name
        }
    
    def reset_collection(self) -> None:
        """Reset the collection (use with caution!)."""
        self.client.delete_collection(settings.chromadb_collection_name)
        self.collection = self.client.get_or_create_collection(
            name=settings.chromadb_collection_name,
            metadata={"description": "Indian pharmaceutical regulatory requirements"}
        )


# Global knowledge base instance
knowledge_base = KnowledgeBase()
