"""
Tenant Isolation System (Gap 7)

Enforces strict data isolation between tenants in ChromaDB:
- Collection-per-tenant namespacing ({tenant_id}_{doc_type}_{submission_id})
- Tenant context middleware with access validation
- Read-only shared regulatory KB
- Isolation audit logging for vendor due diligence
"""

import re
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.core.datetime_utils import utc_now

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class TenantContext(BaseModel):
    """Current tenant context for request scoping"""
    tenant_id: str
    user_id: str
    role: str = "user"  # admin, reviewer, user
    session_id: str = ""
    submission_id: Optional[str] = None


class IsolationAuditEntry(BaseModel):
    """Audit log entry for tenant data access"""
    entry_id: str = Field(default_factory=lambda: f"iso-{uuid.uuid4()}")
    timestamp: datetime = Field(default_factory=utc_now)
    tenant_id: str
    user_id: str
    action: str  # READ, WRITE, QUERY, DENIED
    collection_name: str
    success: bool
    details: str = ""


# ──────────────────────────────────────────────────────
# Tenant Isolation Manager
# ──────────────────────────────────────────────────────

SHARED_KB_PREFIX = "regulatory_kb_"
COLLECTION_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")


class TenantIsolationManager:
    """
    Enforces strict tenant isolation for ChromaDB collections.

    Rules:
    1. Each tenant gets its own collections: {tenant_id}_{doc_type}_{submission_id}
    2. No tenant can access another tenant's collections
    3. Shared regulatory KB is read-only for all tenants
    4. All cross-tenant access attempts are logged and denied
    """

    def __init__(self):
        self.audit_log: List[IsolationAuditEntry] = []

    def build_collection_name(
        self,
        tenant_id: str,
        document_type: str,
        submission_id: Optional[str] = None
    ) -> str:
        """
        Build tenant-scoped collection name.

        Format: {tenant_id}_{document_type}_{submission_id}
        """
        parts = [tenant_id, document_type]
        if submission_id:
            parts.append(submission_id)

        name = "_".join(parts)

        # Sanitize for ChromaDB: only alphanumeric, underscore, hyphen
        name = re.sub(r"[^a-zA-Z0-9_-]", "_", name)

        return name

    def validate_access(
        self,
        context: TenantContext,
        collection_name: str
    ) -> bool:
        """
        Validate that a tenant can access the requested collection.

        Returns True if access is allowed, False if denied.
        """
        # Shared regulatory KB is always readable
        if collection_name.startswith(SHARED_KB_PREFIX):
            self._log_access(context, collection_name, "READ", True, "Shared KB access")
            return True

        # Verify collection belongs to this tenant
        if not collection_name.startswith(context.tenant_id + "_"):
            # CROSS-TENANT ACCESS ATTEMPT — deny and log
            self._log_access(
                context, collection_name, "DENIED", False,
                f"Cross-tenant access DENIED: tenant {context.tenant_id} "
                f"attempted to access collection {collection_name}"
            )
            logger.critical(
                f"CROSS-TENANT ACCESS ATTEMPT BLOCKED: "
                f"tenant={context.tenant_id} → collection={collection_name}",
                extra={
                    "tenant_id": context.tenant_id,
                    "collection": collection_name,
                    "user_id": context.user_id,
                    "security_event": True
                }
            )
            return False

        self._log_access(context, collection_name, "READ", True)
        return True

    def validate_write_access(
        self,
        context: TenantContext,
        collection_name: str
    ) -> bool:
        """Validate write access (shared KB is read-only)."""
        # Shared KB: read-only
        if collection_name.startswith(SHARED_KB_PREFIX):
            self._log_access(
                context, collection_name, "DENIED", False,
                "Write to shared regulatory KB DENIED (read-only)"
            )
            return False

        return self.validate_access(context, collection_name)

    def get_tenant_collections(self, tenant_id: str) -> List[str]:
        """
        Get all collection names belonging to a tenant.

        Production: Query ChromaDB for collections matching prefix.
        Mock: Return from access log.
        """
        accessed = set()
        for entry in self.audit_log:
            if entry.tenant_id == tenant_id and entry.success:
                accessed.add(entry.collection_name)
        return list(accessed)

    def get_isolation_report(self, tenant_id: Optional[str] = None) -> Dict:
        """Generate isolation audit report for vendor due diligence."""
        entries = self.audit_log
        if tenant_id:
            entries = [e for e in entries if e.tenant_id == tenant_id]

        denied = [e for e in entries if e.action == "DENIED"]

        return {
            "total_access_events": len(entries),
            "denied_events": len(denied),
            "cross_tenant_attempts": [
                {
                    "timestamp": e.timestamp.isoformat(),
                    "tenant_id": e.tenant_id,
                    "collection": e.collection_name,
                    "details": e.details
                }
                for e in denied
            ],
            "isolation_status": "SECURE" if not denied else "INCIDENTS_DETECTED"
        }

    def _log_access(
        self,
        context: TenantContext,
        collection: str,
        action: str,
        success: bool,
        details: str = ""
    ):
        """Log a tenant access event."""
        entry = IsolationAuditEntry(
            tenant_id=context.tenant_id,
            user_id=context.user_id,
            action=action,
            collection_name=collection,
            success=success,
            details=details
        )
        self.audit_log.append(entry)


# Global instance
tenant_isolation = TenantIsolationManager()
