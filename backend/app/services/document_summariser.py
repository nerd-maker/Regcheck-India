"""M5 document summarisation services using Anthropic Claude."""

import json
import tempfile
from typing import Any, Dict

from app.services.claude_client import call_claude, MODEL_HAIKU


def _parse_json(content: str) -> Any:
    try:
        return json.loads(content)
    except Exception:
        return None


def _build_attr(
    primary_model: str,
    validator_model: str | None = None,
) -> Dict[str, Any]:
    return {
        "primary_model": primary_model,
        "validator_model": validator_model,
        "provider": "Anthropic Claude",
        "sovereign": False,
    }


class _LLMSummariserBase:
    async def _call_structured(
        self,
        prompt: str,
        system_prompt: str = "Respond with valid JSON only.",
        max_tokens: int = 1800,
    ) -> Dict[str, Any]:
        result = call_claude(
            prompt=prompt,
            system_prompt=system_prompt,
            model=MODEL_HAIKU,
            max_tokens=max_tokens,
            temperature=0.0,
        )
        parsed = _parse_json(result["content"])
        model_used = result["model"]

        if parsed is None:
            # Retry with a formatting prompt
            retry = call_claude(
                prompt=f"Convert this summarisation output into structured JSON only:\n{result['content']}",
                system_prompt="Convert the input into valid JSON only.",
                model=MODEL_HAIKU,
                max_tokens=max_tokens,
                temperature=0.0,
            )
            parsed = _parse_json(retry["content"])

        if parsed is None:
            parsed = {"raw": result["content"]}

        if isinstance(parsed, dict):
            parsed["model_attribution"] = _build_attr(primary_model=model_used)
            return parsed

        return {
            "result": parsed,
            "model_attribution": _build_attr(primary_model=model_used),
        }


class SUGAMApplicationSummariser(_LLMSummariserBase):
    SUGAM_CHECKLIST_SECTIONS = [
        "sponsor_details", "IND_information", "investigational_product",
        "clinical_protocol_synopsis", "investigator_details", "site_details",
        "IEC_approval", "regulatory_history", "safety_data_summary",
        "manufacturing_details", "quality_dossier_summary",
    ]

    async def summarise(self, document_text: str, checklist_type: str) -> Dict[str, Any]:
        prompt = f"""
        You are a CDSCO regulatory reviewer. Extract and summarise the following
        information from this SUGAM portal application document.
        For each section provide:
        1. 2-3 sentence summary
        2. Completeness: COMPLETE / INCOMPLETE / MISSING
        3. Critical flags
        Checklist sections: {self.SUGAM_CHECKLIST_SECTIONS}
        Checklist type: {checklist_type}
        Document:
        {document_text}
        Respond in structured JSON only.
        """
        return await self._call_structured(prompt)


class SAECaseNarrationSummariser(_LLMSummariserBase):
    SAE_SUMMARY_SCHEMA = {
        "case_id": str,
        "report_type": str,
        "patient_demographics": dict,
        "suspect_product": str,
        "event_description": str,
        "onset_date": str,
        "outcome": str,
        "causality_assessment": str,
        "seriousness_criteria": list,
        "reporter_type": str,
        "key_flags": list,
        "priority_score": int,
    }

    async def summarise(self, sae_text: str) -> Dict[str, Any]:
        prompt = f"""
        You are a CDSCO pharmacovigilance expert. Summarise this SAE case report.
        Extract exactly these fields: {list(self.SAE_SUMMARY_SCHEMA.keys())}
        Rules:
        - event_description max 3-5 sentences
        - WHO-UMC causality labels
        - seriousness criteria from standard list
        - include missing mandatory ICH E2A fields in key_flags
        SAE Report:
        {sae_text}
        Respond in structured JSON only. No preamble.
        """
        return await self._call_structured(prompt)


class MeetingTranscriptSummariser(_LLMSummariserBase):
    async def summarise_transcript(self, transcript_text: str) -> Dict[str, Any]:
        prompt = f"""
        Summarise this regulatory meeting transcript for CDSCO officer consumption.
        Extract:
        meeting_overview, key_decisions, action_items, unresolved_items, next_meeting,
        attendees, regulatory_references.
        Meeting Transcript:
        {transcript_text}
        Respond in structured JSON only.
        """
        return await self._call_structured(prompt, max_tokens=1800)

    async def process_audio_bytes(self, audio_bytes: bytes) -> Dict[str, Any]:
        """Transcribe meeting audio when Whisper is available locally."""
        try:
            import whisper
        except Exception:
            return {
                "transcript": "",
                "warning": "Audio transcription is unavailable because the optional Whisper dependency is not installed.",
                "model_attribution": _build_attr(primary_model="local-whisper-unavailable"),
            }

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
            temp_path = handle.name
            handle.write(audio_bytes)

        try:
            model = whisper.load_model("base")
            result = model.transcribe(temp_path)
        finally:
            try:
                import os
                os.unlink(temp_path)
            except OSError:
                pass

        return {
            "transcript": result.get("text", ""),
            "model_attribution": _build_attr(primary_model="whisper-base"),
        }
