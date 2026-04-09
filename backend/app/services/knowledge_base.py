"""
Regulatory knowledge base management using ChromaDB.
"""
import hashlib
import logging
import os
import shutil
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

import chromadb
from chromadb.config import Settings

from app.core.config import settings

logger = logging.getLogger(__name__)

# Force-disable ChromaDB telemetry via env vars.
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"] = "false"


class LightweightHashEmbeddingFunction:
    """Low-memory deterministic embedding fallback for constrained deployments."""

    def __init__(self, dimensions: int = 256):
        self.dimensions = dimensions

    def __call__(self, input: List[str]) -> List[List[float]]:
        embeddings: List[List[float]] = []
        for text in input:
            vector = [0.0] * self.dimensions
            for token in str(text).lower().split():
                digest = hashlib.sha256(token.encode("utf-8")).digest()
                bucket = int.from_bytes(digest[:2], "big") % self.dimensions
                sign = 1.0 if digest[2] % 2 == 0 else -1.0
                vector[bucket] += sign
            norm = sum(abs(v) for v in vector) or 1.0
            embeddings.append([v / norm for v in vector])
        return embeddings

    def name(self) -> str:
        return "lightweight-hash-embedding"


class KnowledgeBase:
    """Manage regulatory knowledge base with lazy ChromaDB initialization."""

    def __init__(self):
        self._storage_path = Path(settings.chromadb_path)
        self._storage_path.mkdir(parents=True, exist_ok=True)
        self._client = None
        self._embedding_fn = None
        self._collection = None

    def _ensure_initialized(self):
        if self._client is not None and self._collection is not None:
            return
        self._client = self._create_client()
        self._embedding_fn = self._create_embedding_function()
        self._collection = self._create_collection_with_recovery()

    @property
    def client(self):
        self._ensure_initialized()
        return self._client

    @property
    def collection(self):
        self._ensure_initialized()
        return self._collection

    @property
    def embedding_fn(self):
        self._ensure_initialized()
        return self._embedding_fn

    def _create_client(self):
        return chromadb.PersistentClient(
            path=str(self._storage_path),
            settings=Settings(anonymized_telemetry=False, allow_reset=True),
        )

    def _create_ephemeral_client(self):
        return chromadb.EphemeralClient(
            settings=Settings(anonymized_telemetry=False, allow_reset=True),
        )

    def _create_embedding_function(self):
        if settings.memory_optimized_mode:
            logger.info("Using lightweight hash embeddings for memory-constrained deployment")
            return LightweightHashEmbeddingFunction()
        try:
            from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

            embedding_fn = SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2",
                device="cpu",
            )
            logger.info("Using SentenceTransformer embedding function (CPU)")
            return embedding_fn
        except Exception as exc:
            logger.warning("SentenceTransformer unavailable, falling back to lightweight embeddings: %s", exc)
            return LightweightHashEmbeddingFunction()

    def _collection_kwargs(self) -> Dict:
        collection_kwargs = {
            "name": settings.chromadb_collection_name,
            "metadata": {"description": "Indian pharmaceutical regulatory requirements"},
        }
        if self._embedding_fn:
            collection_kwargs["embedding_function"] = self._embedding_fn
        return collection_kwargs

    def _create_collection_with_recovery(self):
        try:
            return self._client.get_or_create_collection(**self._collection_kwargs())
        except sqlite3.OperationalError as exc:
            if "collections.topic" not in str(exc):
                raise
            logger.warning("Detected stale ChromaDB schema at %s. Resetting persisted data.", self._storage_path)
            shutil.rmtree(self._storage_path, ignore_errors=True)
            self._storage_path.mkdir(parents=True, exist_ok=True)
            self._client = self._create_ephemeral_client()
            return self._client.get_or_create_collection(**self._collection_kwargs())

    def add_regulatory_document(
        self,
        document_id: str,
        text: str,
        source: str,
        citation: str,
        document_type: str,
        metadata: Optional[Dict] = None,
    ) -> None:
        self.collection.add(
            documents=[text],
            metadatas=[
                {
                    "source": source,
                    "citation": citation,
                    "document_type": document_type,
                    **(metadata or {}),
                }
            ],
            ids=[document_id],
        )

    def add_bulk_documents(self, documents: List[Dict]) -> None:
        ids = [doc["id"] for doc in documents]
        texts = [doc["text"] for doc in documents]
        metadatas = [
            {
                "source": doc["source"],
                "citation": doc["citation"],
                "document_type": doc.get("document_type", "general"),
                **doc.get("metadata", {}),
            }
            for doc in documents
        ]
        self.collection.add(documents=texts, metadatas=metadatas, ids=ids)

    def query(self, query_text: str, n_results: int = 10, document_type_filter: Optional[str] = None) -> Dict:
        where_filter = {"document_type": document_type_filter} if document_type_filter else None
        return self.collection.query(query_texts=[query_text], n_results=n_results, where=where_filter)

    def get_collection_stats(self) -> Dict:
        count = self.collection.count()
        return {"total_documents": count, "collection_name": settings.chromadb_collection_name}

    def reset_collection(self) -> None:
        self.client.delete_collection(settings.chromadb_collection_name)
        self._collection = self.client.get_or_create_collection(
            name=settings.chromadb_collection_name,
            metadata={"description": "Indian pharmaceutical regulatory requirements"},
            embedding_function=self._embedding_fn,
        )


knowledge_base = KnowledgeBase()
