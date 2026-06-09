# backend/app/models/vault.py
"""
SQLAlchemy 2.x ORM models for the Document Vault Engine.

Table names use the 'vault_' prefix to avoid collision with the existing
raw-SQL 'documents' table managed by db.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# vault_documents
# ---------------------------------------------------------------------------

class VaultDocument(Base):
    __tablename__ = "vault_documents"
    __table_args__ = (
        UniqueConstraint("workspace_id", "doc_number", name="uq_vault_documents_workspace_number"),
        Index("idx_vault_docs_workspace", "workspace_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(String, nullable=False)
    doc_number: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    doc_type: Mapped[str] = mapped_column(String, nullable=False, default="Other")
    lifecycle_state: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    current_version: Mapped[str] = mapped_column(String, nullable=False, default="1.0")
    storage_path: Mapped[str] = mapped_column(String, nullable=False)
    storage_bucket: Mapped[str] = mapped_column(String, nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    mime_type: Mapped[str] = mapped_column(String, nullable=False, default="application/octet-stream")
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    owner_initials: Mapped[str] = mapped_column(String, nullable=False, default="")
    classification: Mapped[str] = mapped_column(String, nullable=False, default="Regulatory / General")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    versions: Mapped[list[VaultDocumentVersion]] = relationship(
        "VaultDocumentVersion", back_populates="document", cascade="all, delete-orphan",
        order_by="VaultDocumentVersion.created_at.desc()",
    )
    audit_entries: Mapped[list[VaultDocumentAudit]] = relationship(
        "VaultDocumentAudit", back_populates="document", cascade="all, delete-orphan",
        order_by="VaultDocumentAudit.created_at.desc()",
    )
    compliance_scans: Mapped[list[VaultComplianceScan]] = relationship(
        "VaultComplianceScan", back_populates="document", cascade="all, delete-orphan",
        order_by="VaultComplianceScan.created_at.desc()",
    )


# ---------------------------------------------------------------------------
# vault_document_versions
# ---------------------------------------------------------------------------

class VaultDocumentVersion(Base):
    __tablename__ = "vault_document_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(
        String, ForeignKey("vault_documents.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[str] = mapped_column(String, nullable=False)
    storage_path: Mapped[str] = mapped_column(String, nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    uploaded_by: Mapped[str] = mapped_column(String, nullable=False, default="")
    upload_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    document: Mapped[VaultDocument] = relationship("VaultDocument", back_populates="versions")


# ---------------------------------------------------------------------------
# vault_document_audit
# ---------------------------------------------------------------------------

class VaultDocumentAudit(Base):
    __tablename__ = "vault_document_audit"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(
        String, ForeignKey("vault_documents.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[str] = mapped_column(String, nullable=False)
    from_state: Mapped[str | None] = mapped_column(String, nullable=True)
    to_state: Mapped[str | None] = mapped_column(String, nullable=True)
    user_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    user_initials: Mapped[str] = mapped_column(String, nullable=False, default="")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    document: Mapped[VaultDocument] = relationship("VaultDocument", back_populates="audit_entries")


# ---------------------------------------------------------------------------
# vault_compliance_scans
# ---------------------------------------------------------------------------

class VaultComplianceScan(Base):
    __tablename__ = "vault_compliance_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(
        String, ForeignKey("vault_documents.id", ondelete="CASCADE"), nullable=False
    )
    scan_type: Mapped[str] = mapped_column(String, nullable=False, default="completeness")
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    findings: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    agent_run_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    document: Mapped[VaultDocument] = relationship("VaultDocument", back_populates="compliance_scans")
