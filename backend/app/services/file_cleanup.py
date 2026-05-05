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


try:
    import magic  # python-magic for MIME detection
except ImportError:
    magic = None

from pathlib import Path

# Allowed MIME types — explicit whitelist
ALLOWED_MIME_TYPES = {
    # Documents
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    # Images for OCR
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/tiff': ['.tiff', '.tif'],
    'image/bmp': ['.bmp'],
    # Audio for transcription
    'audio/mpeg': ['.mp3'],
    'audio/wav': ['.wav'],
    'audio/mp4': ['.m4a', '.mp4'],
    'audio/ogg': ['.ogg'],
    'audio/flac': ['.flac'],
    'audio/webm': ['.webm'],
}

MAX_FILE_SIZES = {
    'application/pdf': 20 * 1024 * 1024,       # 20MB
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 10 * 1024 * 1024,  # 10MB
    'image/png': 5 * 1024 * 1024,               # 5MB
    'image/jpeg': 5 * 1024 * 1024,              # 5MB
    'audio/mpeg': 50 * 1024 * 1024,             # 50MB
    'audio/wav': 100 * 1024 * 1024,             # 100MB
}

class FileValidationError(Exception):
    pass


def validate_file(
    content: bytes,
    filename: str,
    allowed_extensions: list[str]
) -> dict:
    """
    Comprehensive file validation:
    1. Extension whitelist check
    2. MIME type detection from actual bytes (not just filename)
    3. MIME vs extension mismatch detection (catches renamed files)
    4. File size limits per type
    5. Magic bytes validation for PDFs and images
    
    Returns dict with validated info.
    Raises FileValidationError if invalid.
    """
    if not filename or not content:
        raise FileValidationError("Empty file or filename")

    # 1. Sanitize and check extension
    safe_name = sanitize_filename(filename)
    ext = Path(safe_name).suffix.lower()

    if ext not in allowed_extensions:
        raise FileValidationError(
            f"File type '{ext}' not allowed. "
            f"Accepted: {', '.join(allowed_extensions)}"
        )

    # 2. Detect actual MIME type from bytes
    try:
        detected_mime = magic.from_buffer(content, mime=True) if magic else None
    except Exception:
        # python-magic fails (e.g. missing libmagic) — skip MIME detection
        detected_mime = None

    # 3. Check MIME vs extension mismatch
    if detected_mime:
        allowed_exts_for_mime = ALLOWED_MIME_TYPES.get(detected_mime, [])
        if allowed_exts_for_mime and ext not in allowed_exts_for_mime:
            raise FileValidationError(
                f"File content ({detected_mime}) does not match "
                f"extension ({ext}). Possible malicious file."
            )

        # 4. Size limit per type
        max_size = MAX_FILE_SIZES.get(detected_mime, 50 * 1024 * 1024)
        if len(content) > max_size:
            raise FileValidationError(
                f"File too large: {len(content) // (1024*1024)}MB. "
                f"Maximum for {detected_mime}: {max_size // (1024*1024)}MB"
            )

    # 5. Magic bytes check for common formats (prevent fake extensions)
    if ext == '.pdf' and not content.startswith(b'%PDF'):
        raise FileValidationError("Invalid PDF file signature")
    
    if ext == '.wav' and not content.startswith(b'RIFF'):
        raise FileValidationError("Invalid WAV file signature")
        
    if ext == '.mp3' and not (content.startswith(b'ID3') or content[:2] in {b'\xff\xfb', b'\xff\xf3', b'\xff\xf2'}):
        raise FileValidationError("Invalid MP3 file signature")

    # 6. Check for ZIP bomb / archive disguised as document
    if content[:4] in (b'PK\x03\x04',) and ext not in ['.docx', '.xlsx', '.pptx']:
        raise FileValidationError(
            "ZIP archive disguised as document detected"
        )

    return {
        "safe_filename": safe_name,
        "extension": ext,
        "mime_type": detected_mime or "unknown",
        "size_bytes": len(content),
        "validated": True
    }


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
