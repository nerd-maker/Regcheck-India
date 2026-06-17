"""ChromaDB Client Singleton wrapper for RegCheck-India."""
from functools import lru_cache
import chromadb
from chromadb.config import Settings
from app.core.config import get_settings

@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.PersistentClient:
    """Return a singleton PersistentClient instance for ChromaDB."""
    settings = get_settings()
    return chromadb.PersistentClient(
        path=settings.chromadb_path,
        settings=Settings(
            anonymized_telemetry=False,
            allow_reset=True
        )
    )
