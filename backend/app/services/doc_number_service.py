from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vault import VaultDocument


async def generate_doc_number(db: AsyncSession, workspace_id: str) -> str:
    result = await db.execute(
        select(func.count()).select_from(VaultDocument).where(
            VaultDocument.workspace_id == workspace_id
        )
    )
    next_number = int(result.scalar_one() or 0) + 1

    while True:
        candidate = f"DOC-{next_number:04d}"
        existing = await db.execute(
            select(VaultDocument.id).where(
                VaultDocument.workspace_id == workspace_id,
                VaultDocument.doc_number == candidate,
            )
        )
        if existing.scalar_one_or_none() is None:
            return candidate
        next_number += 1
