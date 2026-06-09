from __future__ import annotations

import asyncio
import re
from functools import lru_cache
from pathlib import Path

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError(
            "Supabase credentials are not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_KEY before starting the backend."
        )
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _safe_segment(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    return cleaned.strip("-") or "document"


def build_storage_path(
    *,
    workspace_id: str,
    document_id: str,
    version: str,
    filename: str,
) -> str:
    ext = Path(filename).suffix.lower()
    stem = _safe_segment(Path(filename).stem)
    return (
        f"workspaces/{_safe_segment(workspace_id)}/documents/{document_id}/"
        f"v{_safe_segment(version)}/{stem}{ext}"
    )


async def upload_file_to_storage(
    *,
    file_bytes: bytes,
    storage_path: str,
    content_type: str,
    bucket: str | None = None,
) -> None:
    settings = get_settings()
    target_bucket = bucket or settings.supabase_storage_bucket
    client = get_supabase_client()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: client.storage.from_(target_bucket).upload(
            storage_path,
            file_bytes,
            {
                "content-type": content_type,
                "upsert": "false",
            },
        ),
    )


async def get_signed_download_url(
    *,
    storage_path: str,
    bucket: str | None = None,
    expires_in: int = 3600,
) -> str:
    settings = get_settings()
    target_bucket = bucket or settings.supabase_storage_bucket
    client = get_supabase_client()
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: client.storage.from_(target_bucket).create_signed_url(
            storage_path,
            expires_in,
        ),
    )
    if isinstance(result, dict):
        signed_url = result.get("signedURL") or result.get("signed_url")
        if signed_url:
            return signed_url
    signed_url = getattr(result, "signed_url", None) or getattr(result, "signedURL", None)
    if signed_url:
        return signed_url
    raise RuntimeError("Supabase did not return a signed download URL.")


async def delete_file_from_storage(*, storage_path: str, bucket: str | None = None) -> None:
    settings = get_settings()
    target_bucket = bucket or settings.supabase_storage_bucket
    client = get_supabase_client()
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: client.storage.from_(target_bucket).remove([storage_path]),
    )


async def verify_storage_bucket_exists(bucket: str | None = None) -> None:
    settings = get_settings()
    target_bucket = bucket or settings.supabase_storage_bucket
    client = get_supabase_client()
    loop = asyncio.get_event_loop()
    buckets = await loop.run_in_executor(None, lambda: client.storage.list_buckets())

    for existing in buckets:
        name = existing.get("name") if isinstance(existing, dict) else getattr(existing, "name", None)
        if name == target_bucket:
            return

    raise RuntimeError(
        f"Supabase Storage bucket '{target_bucket}' was not found. Create it "
        "manually in the Supabase dashboard with private access before deployment."
    )
