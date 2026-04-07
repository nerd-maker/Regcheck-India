"""Shared runtime state store backed by SQLite for cross-worker consistency."""

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from app.core.config import settings


class RuntimeStateStore:
    def __init__(self, db_path: str | None = None):
        default_path = Path(os.getenv("REGCHECK_RUNTIME_STATE_DB", settings.runtime_state_db))
        self.db_path = Path(db_path) if db_path else default_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._fernet = self._init_fernet()
        self._init_db()

    def _init_fernet(self):
        key = os.getenv("AUDIT_LOG_ENCRYPTION_KEY", settings.audit_log_encryption_key or "")
        if not key:
            return None
        try:
            from cryptography.fernet import Fernet

            return Fernet(key.encode() if isinstance(key, str) else key)
        except Exception:
            return None

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS runtime_state (
                    module TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    state_key TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (module, session_id, state_key)
                )
                """
            )
            conn.commit()

    def _encode_payload(self, payload: Any, encrypt: bool = False) -> str:
        payload_json = json.dumps(payload)
        if encrypt and self._fernet:
            encrypted = self._fernet.encrypt(payload_json.encode("utf-8")).decode("utf-8")
            return json.dumps({"__encrypted__": True, "value": encrypted})
        return payload_json

    def _decode_payload(self, payload_text: str, default: Any = None) -> Any:
        try:
            parsed = json.loads(payload_text)
        except Exception:
            return default

        if isinstance(parsed, dict) and parsed.get("__encrypted__") is True:
            if not self._fernet:
                return default
            try:
                decrypted = self._fernet.decrypt(parsed["value"].encode("utf-8")).decode("utf-8")
                return json.loads(decrypted)
            except Exception:
                return default
        return parsed

    def put(self, module: str, session_id: str, state_key: str, payload: Any, encrypt: bool = False):
        payload_json = self._encode_payload(payload, encrypt=encrypt)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO runtime_state (module, session_id, state_key, payload, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(module, session_id, state_key)
                DO UPDATE SET payload=excluded.payload, updated_at=CURRENT_TIMESTAMP
                """,
                (module, session_id, state_key, payload_json),
            )
            conn.commit()

    def get(self, module: str, session_id: str, state_key: str, default: Any = None) -> Any:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT payload FROM runtime_state
                WHERE module = ? AND session_id = ? AND state_key = ?
                """,
                (module, session_id, state_key),
            ).fetchone()
        if not row:
            return default
        return self._decode_payload(row["payload"], default=default)

    def delete(self, module: str, session_id: str, state_key: str):
        with self._connect() as conn:
            conn.execute(
                """
                DELETE FROM runtime_state
                WHERE module = ? AND session_id = ? AND state_key = ?
                """,
                (module, session_id, state_key),
            )
            conn.commit()

    def append_to_list(self, module: str, session_id: str, state_key: str, item: Any, encrypt: bool = False):
        current = self.get(module, session_id, state_key, default=[])
        if not isinstance(current, list):
            current = []
        current.append(item)
        self.put(module, session_id, state_key, current, encrypt=encrypt)


runtime_state_store = RuntimeStateStore()
