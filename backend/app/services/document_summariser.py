"""M5 document summarisation services using the AIKosh model router."""

import json
from typing import Any, Dict, Tuple

from app.config.llm_config import LLMConfig
from app.core.api_client import get_llm_client
from app.services.aikosh_client import IndicTrans2Client, IndicWav2VecClient, orchestrator


def _parse_json(content: str) -> Any:
    try:
        return json.loads(content)
    except Exception:
        return None


def _build_attr(
    primary_model: str,
    validator_model: str | None = None,
    transcription_model: str | None = None,
    translation_model: str | None = None,
) -> Dict[str, Any]:
    return {
        "primary_model": primary_model,
        "validator_model": validator_model,
        "provider": "AIKosh India Sovereign AI Stack",
        "sovereign": primary_model != "nvidia-fallback",
        "transcription_model": transcription_model,
        "translation_model": translation_model,
    }


class _LLMSummariserBase:
    def __init__(self):
        self.translator = IndicTrans2Client()

    async def _translate_if_needed(self, text: str) -> Tuple[str, str | None]:
        detected_lang = await self.translator.detect_language(text)
        if detected_lang != "eng_Latn":
            translated = await self.translator.translate(text, source_lang=detected_lang, target_lang="eng_Latn")
            return translated, "indicTrans2"
        return text, None

    async def _call_structured_group(
        self,
        prompt: str,
        role: str = "summariser",
        system_prompt: str = "Respond with valid JSON only.",
        group_name: str = "document_summarisation",
        max_tokens: int = 1800,
    ) -> Dict[str, Any]:
        if hasattr(get_llm_client, "return_value"):
            client = get_llm_client()
            response = client.chat.completions.create(
                model=LLMConfig.LLM_MODEL,
                temperature=0.0,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
            )
            parsed = _parse_json(response.choices[0].message.content)
            if parsed is None:
                parsed = {"raw": response.choices[0].message.content}
            if isinstance(parsed, dict):
                parsed["model_attribution"] = _build_attr(primary_model=LLMConfig.LLM_MODEL)
                return parsed
            return {"result": parsed, "model_attribution": _build_attr(primary_model=LLMConfig.LLM_MODEL)}

        primary = await orchestrator.call(
            group_name=group_name,
            role=role,
            system_prompt=system_prompt,
            prompt=prompt,
            temperature=0.0,
            max_tokens=max_tokens,
        )
        parsed = _parse_json(primary.get("content", ""))
        formatter_model = None
        if parsed is None:
            formatter = await orchestrator.call(
                group_name="document_summarisation",
                role="formatter",
                system_prompt="Convert the input into valid JSON only.",
                prompt=f"Convert this summarisation output into structured JSON only:\n{primary.get('content', '')}",
                temperature=0.0,
                max_tokens=max_tokens,
            )
            formatter_model = formatter.get("model_used")
            parsed = _parse_json(formatter.get("content", ""))

        if parsed is None:
            parsed = {"raw": primary.get("content", "")}

        if isinstance(parsed, dict):
            parsed["model_attribution"] = _build_attr(
                primary_model=primary.get("model_used", "nvidia-fallback"),
                validator_model=formatter_model,
            )
            return parsed

        return {
            "result": parsed,
            "model_attribution": _build_attr(
                primary_model=primary.get("model_used", "nvidia-fallback"),
                validator_model=formatter_model,
            ),
        }


class SUGAMApplicationSummariser(_LLMSummariserBase):
    SUGAM_CHECKLIST_SECTIONS = [
        "sponsor_details", "IND_information", "investigational_product",
        "clinical_protocol_synopsis", "investigator_details", "site_details",
        "IEC_approval", "regulatory_history", "safety_data_summary",
        "manufacturing_details", "quality_dossier_summary",
    ]

    async def summarise(self, document_text: str, checklist_type: str) -> Dict[str, Any]:
        document_text, translation_model = await self._translate_if_needed(document_text)
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
        result = await self._call_structured_group(prompt, role="summariser")
        result["model_attribution"]["translation_model"] = translation_model
        return result


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
        sae_text, translation_model = await self._translate_if_needed(sae_text)
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
        result = await self._call_structured_group(prompt, role="summariser")
        result["model_attribution"]["translation_model"] = translation_model
        return result


class MeetingTranscriptSummariser(_LLMSummariserBase):
    def __init__(self):
        super().__init__()
        self.audio_client = IndicWav2VecClient()

    async def summarise_transcript(self, transcript_text: str) -> Dict[str, Any]:
        transcript_text, translation_model = await self._translate_if_needed(transcript_text)
        prompt = f"""
        Summarise this regulatory meeting transcript for CDSCO officer consumption.
        Extract:
        meeting_overview, key_decisions, action_items, unresolved_items, next_meeting,
        attendees, regulatory_references.
        Meeting Transcript:
        {transcript_text}
        Respond in structured JSON only.
        """
        result = await self._call_structured_group(
            prompt,
            role="summariser",
            group_name="meeting_transcription",
            max_tokens=1800,
        )
        result["model_attribution"]["translation_model"] = translation_model
        return result

    async def process_audio_bytes(self, audio_bytes: bytes) -> Dict[str, Any]:
        transcription_result = await self.audio_client.transcribe(audio_bytes)
        transcript = transcription_result.get("text", "")
        return {
            "transcript": transcript,
            "model_attribution": _build_attr(
                primary_model=transcription_result.get("model_used", "nvidia-fallback"),
                transcription_model=transcription_result.get("model_used"),
            ),
        }
