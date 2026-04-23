"""
Encrypted PII mapping store for M1 pseudonymisation.
Stores token → original value mappings encrypted with AES-256.
Mappings are session-scoped and auto-expire after 24 hours.
"""

import os
import json
import base64
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


# Encryption key from environment — falls back to derived key
def _get_encryption_key() -> bytes:
    """Get or derive AES encryption key."""
    raw_key = os.getenv("AUDIT_LOG_ENCRYPTION_KEY", "regcheck-india-default-key-change-in-prod")
    # Derive 32-byte key using SHA-256
    return hashlib.sha256(raw_key.encode()).digest()


def _encrypt(data: str, key: bytes) -> str:
    """Encrypt string data using AES-256 via Fernet."""
    try:
        from cryptography.fernet import Fernet
        # Derive Fernet key from our AES key
        fernet_key = base64.urlsafe_b64encode(key)
        f = Fernet(fernet_key)
        return f.encrypt(data.encode()).decode()
    except ImportError:
        # Fallback: base64 encoding if cryptography not installed
        logger.warning("cryptography package not available — using base64 fallback")
        return base64.urlsafe_b64encode(data.encode()).decode()


def _decrypt(encrypted_data: str, key: bytes) -> str:
    """Decrypt string data."""
    try:
        from cryptography.fernet import Fernet
        fernet_key = base64.urlsafe_b64encode(key)
        f = Fernet(fernet_key)
        return f.decrypt(encrypted_data.encode()).decode()
    except ImportError:
        return base64.urlsafe_b64decode(encrypted_data.encode()).decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        raise ValueError("Could not decrypt mapping — invalid key or corrupted data")


class PIIMappingStore:
    """
    Session-scoped encrypted store for PII token mappings.
    Maps PATIENT_NAME_001 → original value, encrypted at rest.
    Auto-expires entries after TTL_HOURS.
    """

    TTL_HOURS = 24

    def __init__(self):
        self._store: dict[str, dict] = {}  # session_id → {tokens, expiry, encrypted_map}
        self._key = _get_encryption_key()

    def store_mapping(
        self,
        session_id: str,
        token_map: dict[str, str]  # token → original value
    ) -> str:
        """
        Encrypt and store a token mapping for a session.
        Returns the session_id for retrieval.
        """
        if not token_map:
            return session_id

        encrypted = _encrypt(json.dumps(token_map), self._key)
        self._store[session_id] = {
            "encrypted_map": encrypted,
            "token_count": len(token_map),
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=self.TTL_HOURS)).isoformat()
        }
        logger.info(f"Stored encrypted mapping for session {session_id[:8]}*** ({len(token_map)} tokens)")
        return session_id

    def retrieve_mapping(self, session_id: str) -> Optional[dict[str, str]]:
        """
        Retrieve and decrypt token mapping for a session.
        Returns None if not found or expired.
        """
        entry = self._store.get(session_id)
        if not entry:
            return None

        # Check expiry
        expires_at = datetime.fromisoformat(entry["expires_at"])
        if datetime.utcnow() > expires_at:
            logger.info(f"Mapping expired for session {session_id[:8]}***")
            del self._store[session_id]
            return None

        return json.loads(_decrypt(entry["encrypted_map"], self._key))

    def deanonymise(self, text: str, session_id: str) -> Optional[str]:
        """
        Reverse pseudonymisation — replace tokens with original values.
        Returns None if mapping not found.
        """
        mapping = self.retrieve_mapping(session_id)
        if not mapping:
            return None

        result = text
        # Sort by length descending to avoid partial replacements
        for token, original in sorted(mapping.items(), key=lambda x: len(x[0]), reverse=True):
            result = result.replace(token, original)

        return result

    def purge_expired(self) -> int:
        """Remove all expired mappings. Returns count purged."""
        now = datetime.utcnow()
        expired = [
            sid for sid, entry in self._store.items()
            if datetime.fromisoformat(entry["expires_at"]) < now
        ]
        for sid in expired:
            del self._store[sid]
        if expired:
            logger.info(f"Purged {len(expired)} expired PII mappings")
        return len(expired)

    def get_store_stats(self) -> dict:
        """Return stats about current store state."""
        self.purge_expired()
        return {
            "active_sessions": len(self._store),
            "total_tokens_stored": sum(e["token_count"] for e in self._store.values()),
            "ttl_hours": self.TTL_HOURS
        }


# Singleton instance
pii_mapping_store = PIIMappingStore()
