"""
Regulatory knowledge base management using Supabase pgvector.
"""
import hashlib
import logging
import os
import json
import asyncio
from pathlib import Path
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor

from app.core.config import settings

logger = logging.getLogger(__name__)


class ChromaCompatibilityCollection:
    def __init__(self, name: str):
        self.name = name
        # In-memory storage of documents, metadatas, ids, and embeddings
        self._documents = []
        self._metadatas = []
        self._ids = []
        self._embeddings = []

    def count(self) -> int:
        return len(self._documents)

    def add(self, documents: list[str], metadatas: list[dict], ids: list[str], embeddings=None):
        from app.services.pgvector_service import get_embedding_model, embed_text
        
        # Ensure model is loaded
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        if loop.is_running():
            with ThreadPoolExecutor(max_workers=1) as executor:
                executor.submit(lambda: asyncio.run(get_embedding_model())).result()
        else:
            asyncio.run(get_embedding_model())

        for doc, meta, doc_id in zip(documents, metadatas, ids):
            emb = embed_text(doc)
            if doc_id in self._ids:
                idx = self._ids.index(doc_id)
                self._documents[idx] = doc
                self._metadatas[idx] = meta
                self._embeddings[idx] = emb
            else:
                self._documents.append(doc)
                self._metadatas.append(meta)
                self._ids.append(doc_id)
                self._embeddings.append(emb)

    def query(self, query_texts: list[str], n_results: int = 5, include=None):
        from app.services.pgvector_service import get_embedding_model, embed_text
        
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        if loop.is_running():
            with ThreadPoolExecutor(max_workers=1) as executor:
                executor.submit(lambda: asyncio.run(get_embedding_model())).result()
        else:
            asyncio.run(get_embedding_model())

        query_embeddings = [embed_text(q) for q in query_texts]
        
        results_documents = []
        results_distances = []
        results_metadatas = []
        
        for q_emb in query_embeddings:
            scores = []
            for idx, emb in enumerate(self._embeddings):
                # Cosine similarity calculation: dot(A, B) / (norm(A) * norm(B))
                dot_product = sum(x * y for x, y in zip(q_emb, emb))
                norm_q = sum(x * x for x in q_emb) ** 0.5
                norm_e = sum(x * x for x in emb) ** 0.5
                similarity = dot_product / (norm_q * norm_e) if (norm_q * norm_e) > 0 else 0.0
                distance = 1.0 - similarity
                scores.append((distance, idx))
            
            scores.sort(key=lambda x: x[0])
            top_scores = scores[:n_results]
            
            docs = [self._documents[idx] for _, idx in top_scores]
            dists = [dist for dist, _ in top_scores]
            metas = [self._metadatas[idx] for _, idx in top_scores]
            
            results_documents.append(docs)
            results_distances.append(dists)
            results_metadatas.append(metas)
            
        return {
            "documents": results_documents,
            "distances": results_distances,
            "metadatas": results_metadatas
        }


class ChromaCompatibilityClient:
    def __init__(self):
        self._collections = {}

    def get_or_create_collection(self, name: str, **kwargs):
        if name not in self._collections:
            self._collections[name] = ChromaCompatibilityCollection(name)
        return self._collections[name]

    def delete_collection(self, name: str):
        if name in self._collections:
            del self._collections[name]


class KnowledgeBaseCollectionCompat:
    def __init__(self, kb):
        self.kb = kb

    def query(self, query_texts=None, n_results=10, where=None, include=None, query_text=None, **kwargs):
        q = query_text
        if query_texts and len(query_texts) > 0:
            q = query_texts[0]
        
        doc_type_filter = None
        if where:
            doc_type_filter = where.get("document_type") or where.get("framework") or where.get("jurisdiction")
            if doc_type_filter == "India":
                doc_type_filter = None
                
        return self.kb.query(query_text=q, n_results=n_results, document_type_filter=doc_type_filter)
        
    def count(self) -> int:
        stats = self.kb.get_collection_stats()
        return stats.get("total_documents", 0)

    def add(self, documents, metadatas, ids):
        docs = []
        for doc, meta, doc_id in zip(documents, metadatas, ids):
            docs.append({
                "id": doc_id,
                "text": doc,
                "source": meta.get("source", meta.get("source_doc", "Unknown")),
                "citation": meta.get("citation", ""),
                "document_type": meta.get("document_type", "general"),
                "metadata": meta
            })
        self.kb.add_bulk_documents(docs)


class KnowledgeBase:
    """Manage regulatory knowledge base with pgvector."""

    def __init__(self):
        self._chroma_compat_client = ChromaCompatibilityClient()
        self._collection_compat = KnowledgeBaseCollectionCompat(self)

    @property
    def client(self):
        return self._chroma_compat_client

    @property
    def collection(self):
        return self._collection_compat

    def add_regulatory_document(
        self,
        document_id: str,
        text: str,
        source: str,
        citation: str,
        document_type: str,
        metadata: Optional[Dict] = None,
    ) -> None:
        doc = {
            "id": document_id,
            "text": text,
            "source": source,
            "citation": citation,
            "document_type": document_type,
            "metadata": metadata or {}
        }
        self.add_bulk_documents([doc])

    def add_bulk_documents(self, documents: List[Dict]) -> None:
        async def _async_add():
            from app.core.config import get_settings
            from app.services.pgvector_service import get_embedding_model, embed_text
            import asyncpg
            
            await get_embedding_model()
            
            settings = get_settings()
            db_url = settings.safe_supabase_db_url or settings.database_url
            if not db_url:
                logger.error("No database connection string configured for pgvector")
                return
                
            conn = await asyncpg.connect(db_url, timeout=10.0, statement_cache_size=0)
            try:
                for idx, doc in enumerate(documents):
                    text = doc["text"]
                    loop = asyncio.get_event_loop()
                    embedding = await loop.run_in_executor(None, embed_text, text)
                    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                    
                    meta = doc.get("metadata", {})
                    metadata_dict = {
                        "title": meta.get("title", doc["source"]),
                        "short_name": meta.get("short_name", doc["source"]),
                        "category": meta.get("category", "general"),
                        "authority": meta.get("authority", "CDSCO"),
                        "citation": doc.get("citation", ""),
                    }
                    metadata_str = json.dumps(metadata_dict)
                    
                    await conn.execute("""
                        INSERT INTO regulatory_embeddings
                            (doc_name, framework, section, page_number, chunk_index, content, embedding, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb)
                    """,
                        doc["source"],
                        doc.get("document_type", "general"),
                        meta.get("section", ""),
                        meta.get("page_number", 0),
                        idx,
                        text,
                        embedding_str,
                        metadata_str,
                    )
            finally:
                await conn.close()

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        if loop.is_running():
            with ThreadPoolExecutor(max_workers=1) as executor:
                executor.submit(lambda: asyncio.run(_async_add())).result()
        else:
            asyncio.run(_async_add())

    def query(self, query_text: str, n_results: int = 10, document_type_filter: Optional[str] = None) -> Dict:
        from app.services.pgvector_service import retrieve_regulatory_context as pg_retrieve
        
        async def _async_query():
            return await pg_retrieve(query_text, n_results=n_results, framework_filter=document_type_filter)

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        if loop.is_running():
            with ThreadPoolExecutor(max_workers=1) as executor:
                results = executor.submit(lambda: asyncio.run(_async_query())).result()
        else:
            results = asyncio.run(_async_query())
            
        documents = []
        metadatas = []
        distances = []
        for r in results:
            documents.append(r["content"])
            metadatas.append({
                "title": r["title"],
                "short_name": r["short_name"],
                "category": r["category"],
                "authority": r["authority"],
                "source": r["doc_name"],
                "citation": r["citation"],
                "document_type": r["framework"],
                "page_number": r["page_number"],
                "section": r["section"]
            })
            # Convert similarity back to cosine distance
            distances.append(1.0 - r.get("similarity", 0.9))
             
        return {
            "documents": [documents],
            "metadatas": [metadatas],
            "distances": [distances]
        }

    def get_collection_stats(self) -> Dict:
        async def _async_count():
            from app.core.config import get_settings
            import asyncpg
            settings = get_settings()
            db_url = settings.safe_supabase_db_url or settings.database_url
            if not db_url:
                return 0
            conn = await asyncpg.connect(db_url, timeout=10.0, statement_cache_size=0)
            try:
                count = await conn.fetchval("SELECT COUNT(*) FROM regulatory_embeddings")
                return count or 0
            finally:
                await conn.close()
                
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        if loop.is_running():
            with ThreadPoolExecutor(max_workers=1) as executor:
                count = executor.submit(lambda: asyncio.run(_async_count())).result()
        else:
            count = asyncio.run(_async_count())
            
        return {"total_documents": count, "collection_name": settings.chromadb_collection_name}

    def reset_collection(self) -> None:
        async def _async_reset():
            from app.core.config import get_settings
            import asyncpg
            settings = get_settings()
            db_url = settings.safe_supabase_db_url or settings.database_url
            if not db_url:
                return
            conn = await asyncpg.connect(db_url, timeout=10.0, statement_cache_size=0)
            try:
                await conn.execute("TRUNCATE TABLE regulatory_embeddings")
            finally:
                await conn.close()
                
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        if loop.is_running():
            with ThreadPoolExecutor(max_workers=1) as executor:
                executor.submit(lambda: asyncio.run(_async_reset())).result()
        else:
            asyncio.run(_async_reset())


knowledge_base = KnowledgeBase()
