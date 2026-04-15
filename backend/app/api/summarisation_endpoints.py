"""Summarisation endpoints (M5)."""

from pathlib import Path

from fastapi import APIRouter, File, Header, HTTPException, UploadFile

from app.core.config import settings
from app.models.hackathon_schemas import MeetingSummaryRequest, SAECaseSummaryRequest, SUGAMSummaryRequest
from app.services.document_summariser import (
    MeetingTranscriptSummariser,
    SAECaseNarrationSummariser,
    SUGAMApplicationSummariser,
)

router = APIRouter()
sugam_summariser = SUGAMApplicationSummariser()
sae_summariser = SAECaseNarrationSummariser()
meeting_summariser = MeetingTranscriptSummariser()

_AUDIO_CONTENT_TYPES = {
    ".wav": {"audio/wav", "audio/x-wav", "audio/wave"},
    ".mp3": {"audio/mpeg"},
    ".m4a": {"audio/mp4", "audio/x-m4a", "audio/m4a"},
}


async def _read_validated_audio(file: UploadFile) -> bytes:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _AUDIO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported audio type: {suffix or 'unknown'}")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty")
    if len(raw) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio file exceeds maximum allowed size")

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in _AUDIO_CONTENT_TYPES[suffix]:
        raise HTTPException(status_code=400, detail=f"Content type does not match file extension: {content_type}")

    if suffix == ".wav" and raw[:4] != b"RIFF":
        raise HTTPException(status_code=400, detail="Invalid WAV file signature")
    if suffix == ".mp3" and not (raw.startswith(b"ID3") or raw[:2] in {b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"}):
        raise HTTPException(status_code=400, detail="Invalid MP3 file signature")
    if suffix == ".m4a" and b"ftyp" not in raw[:32]:
        raise HTTPException(status_code=400, detail="Invalid M4A file signature")

    return raw


@router.post("/sugam-application")
async def summarise_sugam(request: SUGAMSummaryRequest, x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    return await sugam_summariser.summarise(request.document_text, request.checklist_type)


@router.post("/sae-case")
async def summarise_sae_case(request: SAECaseSummaryRequest, x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    return await sae_summariser.summarise(request.sae_text)


@router.post("/meeting")
async def summarise_meeting(request: MeetingSummaryRequest, x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    return await meeting_summariser.summarise_transcript(request.transcript_text)


@router.post("/meeting-audio")
async def summarise_meeting_audio(file: UploadFile = File(...), x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    audio_bytes = await _read_validated_audio(file)
    transcription = await meeting_summariser.process_audio_bytes(audio_bytes)
    transcript = transcription.get("transcript", "").strip()
    if not transcript:
        return transcription
    result = await meeting_summariser.summarise_transcript(transcript)
    result["transcript"] = transcript
    result["model_attribution"]["transcription_model"] = transcription.get("model_attribution", {}).get("primary_model")
    return result


@router.get("/schema/{type}")
async def get_summary_schema(type: str, x_session_id: str = Header(default="default_session")):
    _ = x_session_id
    _attr = {"primary_model": "claude-haiku-4-20250414", "provider": "Anthropic Claude", "sovereign": False}
    if type == "sugam-application":
        return {
            "sections": SUGAMApplicationSummariser.SUGAM_CHECKLIST_SECTIONS,
            "model_attribution": _attr,
        }
    if type == "sae-case":
        return {
            "schema": list(SAECaseNarrationSummariser.SAE_SUMMARY_SCHEMA.keys()),
            "model_attribution": _attr,
        }
    if type == "meeting":
        return {
            "schema": [
                "meeting_overview",
                "key_decisions",
                "action_items",
                "unresolved_items",
                "next_meeting",
                "attendees",
                "regulatory_references",
            ],
            "model_attribution": _attr,
        }
    raise HTTPException(status_code=404, detail="Unsupported summary type")
