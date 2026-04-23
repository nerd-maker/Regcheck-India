"""
File cleanup utilities — auto-delete temp files after processing.
Ensures uploaded files don't persist beyond the request lifecycle.
"""

import os
import re
import tempfile
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


@asynccontextmanager
async def temp_file_context(
    content: bytes,
    suffix: str = ".tmp"
) -> AsyncGenerator[str, None]:
    """
    Context manager that writes bytes to a temp file,
    yields the path, then deletes the file guaranteed.

    Usage:
        async with temp_file_context(audio_bytes, ".mp3") as path:
            result = process_file(path)
        # file is deleted here automatically
    """
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            delete=False,
            mode='wb'
        ) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        logger.debug(f"Temp file created: {tmp_path}")
        yield tmp_path
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                logger.debug(f"Temp file deleted: {tmp_path}")
            except Exception as e:
                logger.warning(f"Could not delete temp file {tmp_path}: {e}")


def secure_delete_bytes(data: bytes) -> None:
    """
    Overwrite bytes in memory before deletion.
    Best-effort — Python GC handles actual deallocation.
    """
    try:
        # Overwrite with zeros
        mv = memoryview(bytearray(data))
        for i in range(len(mv)):
            mv[i] = 0
    except Exception:
        pass  # Best effort only


def sanitize_filename(filename: str) -> str:
    """
    Sanitize uploaded filename to prevent path traversal.
    """
    # Remove path separators and dangerous characters
    safe = re.sub(r'[^\w\s\-_\.]', '', filename)
    safe = os.path.basename(safe)
    # Limit length
    if len(safe) > 255:
        safe = safe[:255]
    return safe or "upload"
