"""
Audio transcription service for RegCheck-India M2.
Uses Sarvam AI Saaras v3 for Indian language speech-to-text.
Handles audio chunking for files longer than 30 seconds.
"""

import os
import io
import logging
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

SARVAM_API_ENDPOINT = "https://api.sarvam.ai/speech-to-text"
MAX_CHUNK_SECONDS = 25  # Sarvam REST API limit is 30s, use 25s for safety
SUPPORTED_FORMATS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.webm', '.wma', '.amr']


def transcribe_audio(
    audio_bytes: bytes,
    filename: str,
    sarvam_api_key: str,
    language_code: str = "unknown"  # unknown = auto-detect
) -> dict:
    """
    Transcribe audio file using Sarvam AI Saaras v3.
    Handles chunking for files longer than 25 seconds.

    Args:
        audio_bytes: Raw audio file bytes
        filename: Original filename for format detection
        sarvam_api_key: Sarvam AI API subscription key
        language_code: BCP-47 language code or 'unknown' for auto-detect

    Returns:
        dict with transcript, language_detected, duration_seconds, chunk_count
    """
    import requests

    filename_lower = filename.lower()
    ext = next((e for e in SUPPORTED_FORMATS if filename_lower.endswith(e)), None)

    if not ext:
        raise ValueError(
            f"Unsupported audio format: {filename}. "
            f"Supported: {', '.join(SUPPORTED_FORMATS)}"
        )

    # Get audio duration
    duration_seconds = _get_audio_duration(audio_bytes, ext)
    logger.info(f"Audio duration: {duration_seconds:.1f}s, format: {ext}")

    headers = {
        "api-subscription-key": sarvam_api_key
    }

    # Short audio — single API call
    if duration_seconds <= MAX_CHUNK_SECONDS:
        transcript = _transcribe_chunk(
            audio_bytes=audio_bytes,
            filename=filename,
            headers=headers,
            language_code=language_code
        )
        return {
            "transcript": transcript["text"],
            "language_detected": transcript.get("language_code", language_code),
            "duration_seconds": round(duration_seconds, 1),
            "chunk_count": 1,
            "method": "SARVAM_SAARAS_V3"
        }

    # Long audio — chunk and stitch
    logger.info(f"Audio exceeds {MAX_CHUNK_SECONDS}s, chunking into segments")
    chunks = _chunk_audio(audio_bytes, ext, MAX_CHUNK_SECONDS)
    logger.info(f"Split into {len(chunks)} chunks")

    transcripts = []
    detected_language = language_code

    for i, chunk_bytes in enumerate(chunks):
        logger.info(f"Transcribing chunk {i+1}/{len(chunks)}")
        try:
            result = _transcribe_chunk(
                audio_bytes=chunk_bytes,
                filename=f"chunk_{i}{ext}",
                headers=headers,
                language_code=language_code
            )
            transcripts.append(result["text"])
            if i == 0:
                detected_language = result.get("language_code", language_code)
        except Exception as e:
            logger.warning(f"Chunk {i+1} transcription failed: {e}")
            transcripts.append(f"[Transcription failed for segment {i+1}]")

    full_transcript = " ".join(t for t in transcripts if t.strip())

    return {
        "transcript": full_transcript,
        "language_detected": detected_language,
        "duration_seconds": round(duration_seconds, 1),
        "chunk_count": len(chunks),
        "method": "SARVAM_SAARAS_V3"
    }


def _transcribe_chunk(
    audio_bytes: bytes,
    filename: str,
    headers: dict,
    language_code: str
) -> dict:
    """Send a single audio chunk to Sarvam API."""
    import requests

    files = {
        "file": (filename, io.BytesIO(audio_bytes), _get_mime_type(filename))
    }
    data = {
        "model": "saaras:v3",
        "mode": "transcribe",
    }
    if language_code and language_code != "unknown":
        data["language_code"] = language_code

    response = requests.post(
        SARVAM_API_ENDPOINT,
        headers=headers,
        files=files,
        data=data,
        timeout=60
    )

    if response.status_code == 401:
        raise ValueError("Invalid Sarvam API key — check your key in settings")
    if response.status_code == 429:
        raise ValueError("Sarvam API rate limit exceeded — please wait and try again")
    if response.status_code != 200:
        raise ValueError(f"Sarvam API error {response.status_code}: {response.text}")

    result = response.json()
    return {
        "text": result.get("transcript", ""),
        "language_code": result.get("language_code", "unknown")
    }


def _get_audio_duration(audio_bytes: bytes, ext: str) -> float:
    """Get audio duration in seconds using pydub."""
    try:
        from pydub import AudioSegment
        fmt = ext.lstrip(".")
        if fmt == "mp3":
            fmt = "mp3"
        elif fmt == "m4a":
            fmt = "mp4"
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
        return len(audio) / 1000.0
    except Exception as e:
        logger.warning(f"Could not determine audio duration: {e}")
        return 0.0


def _chunk_audio(audio_bytes: bytes, ext: str, chunk_seconds: int) -> list[bytes]:
    """Split audio into chunks of chunk_seconds duration."""
    from pydub import AudioSegment

    fmt = ext.lstrip(".")
    if fmt == "m4a":
        fmt = "mp4"

    audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
    chunk_ms = chunk_seconds * 1000
    chunks = []

    for start in range(0, len(audio), chunk_ms):
        chunk = audio[start:start + chunk_ms]
        buf = io.BytesIO()
        chunk.export(buf, format="wav")  # export as WAV for reliability
        chunks.append(buf.getvalue())

    return chunks


def _get_mime_type(filename: str) -> str:
    """Get MIME type from filename."""
    ext = filename.lower().split(".")[-1]
    mime_map = {
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "aac": "audio/aac",
        "ogg": "audio/ogg",
        "flac": "audio/flac",
        "m4a": "audio/mp4",
        "webm": "audio/webm",
        "wma": "audio/x-ms-wma",
        "amr": "audio/amr"
    }
    return mime_map.get(ext, "audio/mpeg")
