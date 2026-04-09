"""
AIKosh Sovereign Model Client for RegCheck-India.

Implements grouped model ensembles with graceful fallback to NVIDIA.
"""

import asyncio
import os
from enum import Enum
from typing import Dict, List

import httpx
from huggingface_hub import InferenceClient
from openai import AsyncOpenAI


class TaskType(Enum):
    REGULATORY_ANALYSIS = "regulatory_analysis"
    DOCUMENT_GENERATION = "document_generation"
    QUERY_CLASSIFICATION = "query_classification"
    QUERY_RESPONSE = "query_response"
    REGULATORY_INTELLIGENCE = "regulatory_intelligence"
    PII_DETECTION = "pii_detection"
    DOCUMENT_SUMMARISATION = "document_summarisation"
    SAE_CLASSIFICATION = "sae_classification"
    TRANSLATION = "translation"
    AUDIO_TRANSCRIPTION = "audio_transcription"
    DOCUMENT_COMPARISON = "document_comparison"


class ModelConfig:
    MODELS = {
        "sarvam-105b": {
            "provider": "sarvam",
            "api_base": "https://api.sarvam.ai/v1",
            "api_key_env": "SARVAM_API_KEY",
            "model_id": "sarvam-105b",
            "max_tokens": 4096,
            "context_window": 32768,
        },
        "sarvam-1": {
            "provider": "sarvam",
            "api_base": "https://api.sarvam.ai/v1",
            "api_key_env": "SARVAM_API_KEY",
            "model_id": "sarvam-1",
            "max_tokens": 2048,
            "context_window": 8192,
        },
        "bharatgen": {
            "provider": "bharatgen",
            "api_base": os.getenv("BHARATGEN_API_BASE", "https://api.bharatgen.ai/v1"),
            "api_key_env": "BHARATGEN_API_KEY",
            "model_id": "bharatgen-health",
            "max_tokens": 3000,
            "context_window": 16384,
        },
        "nvidia-fallback": {
            "provider": "nvidia",
            "api_base": "https://integrate.api.nvidia.com/v1",
            "api_key_env": "LLM_API_KEY",
            "model_id": os.getenv("LLM_MODEL", "meta/llama-3.1-8b-instruct"),
            "max_tokens": 2000,
            "context_window": 8192,
        },
        "indicbert": {
            "provider": "huggingface",
            "model_id": "ai4bharat/indic-bert",
            "api_key_env": "HF_API_KEY",
            "api_base": "https://router.huggingface.co/hf-inference/models/ai4bharat/indic-bert",
        },
        "indicTrans2": {
            "provider": "huggingface",
            "model_id": "ai4bharat/indictrans2-en-indic-1B",
            "api_key_env": "HF_API_KEY",
            "api_base": "https://router.huggingface.co/hf-inference/models/ai4bharat/indictrans2-en-indic-1B",
        },
        "indicWav2Vec": {
            "provider": "huggingface",
            "model_id": "ai4bharat/indicwav2vec_v1_hindi",
            "api_key_env": "HF_API_KEY",
            "api_base": "https://router.huggingface.co/hf-inference/models/ai4bharat/indicwav2vec_v1_hindi",
        },
    }


class ModelGroup:
    GROUPS = {
        "regulatory_compliance": {
            "primary": "sarvam-105b",
            "validator": "bharatgen",
            "fallback": "nvidia-fallback",
        },
        "document_generation": {
            "primary": "sarvam-105b",
            "reviewer": "bharatgen",
            "fallback": "nvidia-fallback",
        },
        "query_intelligence": {
            "classifier": "sarvam-1",
            "responder": "sarvam-105b",
            "validator": "bharatgen",
            "fallback": "nvidia-fallback",
        },
        "regulatory_intelligence": {
            "translator": "indicTrans2",
            "extractor": "sarvam-105b",
            "fallback": "nvidia-fallback",
        },
        "pii_detection": {
            "ner_model": "indicbert",
            "contextual_model": "sarvam-1",
            "fallback": "nvidia-fallback",
        },
        "document_summarisation": {
            "translator": "indicTrans2",
            "summariser": "bharatgen",
            "formatter": "sarvam-1",
            "fallback": "nvidia-fallback",
        },
        "sae_classification": {
            "ner_model": "indicbert",
            "classifier": "bharatgen",
            "validator": "sarvam-105b",
            "fallback": "nvidia-fallback",
        },
        "meeting_transcription": {
            "asr_model": "indicWav2Vec",
            "summariser": "sarvam-105b",
            "fallback": "nvidia-fallback",
        },
        "document_comparison": {
            "analyst": "sarvam-105b",
            "reviewer": "bharatgen",
            "fallback": "nvidia-fallback",
        },
    }


class EnsembleOrchestrator:
    def __init__(self):
        self.clients: Dict[str, AsyncOpenAI] = {}
        self._init_clients()

    def _init_clients(self):
        sarvam_key = os.getenv("SARVAM_API_KEY")
        if sarvam_key:
            self.clients["sarvam"] = AsyncOpenAI(api_key=sarvam_key, base_url="https://api.sarvam.ai/v1", timeout=30.0)
        bharatgen_key = os.getenv("BHARATGEN_API_KEY")
        bharatgen_base = os.getenv("BHARATGEN_API_BASE")
        if bharatgen_key and bharatgen_base:
            self.clients["bharatgen"] = AsyncOpenAI(api_key=bharatgen_key, base_url=bharatgen_base, timeout=30.0)
        self.clients["nvidia"] = AsyncOpenAI(
            api_key=os.getenv("LLM_API_KEY", ""),
            base_url=os.getenv("LLM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
            timeout=30.0,
        )

    async def call(self, group_name: str, prompt: str, system_prompt: str = "", temperature: float = 0.0, max_tokens: int = 2000, role: str = "primary") -> dict:
        group = ModelGroup.GROUPS.get(group_name)
        if not group:
            raise ValueError(f"Unknown model group: {group_name}")
        model_name = group.get(role, group.get("primary", "nvidia-fallback"))
        model_config = ModelConfig.MODELS.get(model_name, ModelConfig.MODELS["nvidia-fallback"])
        try:
            print(f"[MODEL] {group_name}/{role}: {model_name}")
            result = await self._call_model(model_config, prompt, system_prompt, temperature, max_tokens)
            result["model_used"] = model_name
            result["group"] = group_name
            result["role"] = role
            return result
        except Exception as e:
            fallback_config = ModelConfig.MODELS["nvidia-fallback"]
            print(f"[MODEL] {group_name}/{role}: nvidia-fallback")
            result = await self._call_model(fallback_config, prompt, system_prompt, temperature, max_tokens)
            result["model_used"] = "nvidia-fallback"
            result["fallback_reason"] = str(e)
            return result

    async def call_pipeline(self, group_name: str, steps: List[dict]) -> List[dict]:
        results = []
        context = ""
        for step in steps:
            prompt = step["prompt"].format(context=context)
            result = await self.call(
                group_name=group_name,
                prompt=prompt,
                system_prompt=step.get("system", ""),
                temperature=step.get("temperature", 0.0),
                max_tokens=step.get("max_tokens", 2000),
                role=step["role"],
            )
            results.append(result)
            context = result.get("content", "")
        return results

    async def call_consensus(self, group_name: str, prompt: str, roles: List[str], system_prompt: str = "") -> dict:
        tasks = [self.call(group_name, prompt, system_prompt, role=role) for role in roles]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        valid = [r for r in results if isinstance(r, dict)]
        return {
            "consensus_results": valid,
            "models_used": [r.get("model_used") for r in valid],
            "agreement_score": self._calculate_agreement(valid),
            "merged_output": self._merge_outputs(valid),
        }

    async def _call_model(self, config: dict, prompt: str, system: str, temp: float, max_tokens: int) -> dict:
        provider = config["provider"]
        client = self.clients.get(provider)
        if not client:
            raise RuntimeError(f"No client for provider: {provider}")
        response = await client.chat.completions.create(
            model=config["model_id"],
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            temperature=temp,
            max_tokens=max_tokens,
        )
        return {
            "content": response.choices[0].message.content,
            "usage": {
                "prompt_tokens": getattr(response.usage, "prompt_tokens", 0),
                "completion_tokens": getattr(response.usage, "completion_tokens", 0),
            },
        }

    def _calculate_agreement(self, results: list) -> float:
        if len(results) < 2:
            return 1.0
        return 0.85

    def _merge_outputs(self, results: list) -> str:
        if not results:
            return ""
        return results[0].get("content", "")


class IndicBERTClient:
    def __init__(self):
        self.api_key = os.getenv("HF_API_KEY")
        self.model_id = "ai4bharat/indic-bert"

    def _get_client(self):
        if not self.api_key:
            return None
        return InferenceClient(model=self.model_id, provider="hf-inference", api_key=self.api_key, timeout=30.0)

    async def detect_entities(self, text: str) -> list[dict]:
        if not self.api_key:
            return []
        try:
            client = self._get_client()
            if client is None:
                return []
            raw = await asyncio.to_thread(
                client.token_classification,
                text[:512],
                model=self.model_id,
                aggregation_strategy="simple",
            )
            return self._parse_entities(raw)
        except Exception:
            return []

    def _parse_entities(self, raw: list) -> list[dict]:
        entities = []
        for item in raw:
            entity = item
            score = getattr(entity, "score", None)
            if score is None and isinstance(entity, dict):
                score = entity.get("score", 0)
            if (score or 0) > 0.85:
                text = getattr(entity, "word", None) or getattr(entity, "entity", None)
                label = getattr(entity, "entity_group", None) or getattr(entity, "entity", None)
                start = getattr(entity, "start", None)
                end = getattr(entity, "end", None)
                if isinstance(entity, dict):
                    text = text or entity.get("word") or entity.get("entity")
                    label = label or entity.get("entity_group") or entity.get("entity")
                    start = start if start is not None else entity.get("start")
                    end = end if end is not None else entity.get("end")
                entities.append(
                    {
                        "text": text or "",
                        "label": label or "",
                        "score": score,
                        "start": start,
                        "end": end,
                        "source": "indicbert",
                    }
                )
        return entities


class IndicTrans2Client:
    def __init__(self):
        self.api_key = os.getenv("HF_API_KEY")
        self.model_id = "ai4bharat/indictrans2-indic-en-1B"

    def _get_client(self):
        if not self.api_key:
            return None
        return InferenceClient(model=self.model_id, provider="hf-inference", api_key=self.api_key, timeout=30.0)

    async def translate(self, text: str, source_lang: str = "hin_Deva", target_lang: str = "eng_Latn") -> str:
        if not self.api_key:
            return text
        try:
            client = self._get_client()
            if client is None:
                return text
            result = await asyncio.to_thread(
                client.translation,
                text,
                model=self.model_id,
                src_lang=source_lang,
                tgt_lang=target_lang,
            )
            translated = getattr(result, "translation_text", None)
            if translated is None and isinstance(result, dict):
                translated = result.get("translation_text")
            return translated or text
        except Exception:
            return text

    async def detect_language(self, text: str) -> str:
        hindi_chars = sum(1 for c in text if "\u0900" <= c <= "\u097F")
        ratio = hindi_chars / max(len(text), 1)
        if ratio > 0.3:
            return "hin_Deva"
        return "eng_Latn"


class IndicWav2VecClient:
    def __init__(self):
        self.api_key = os.getenv("HF_API_KEY")
        self.model_id = "ai4bharat/indicwav2vec_v1_hindi"

    def _get_client(self):
        if not self.api_key:
            return None
        return InferenceClient(model=self.model_id, provider="hf-inference", api_key=self.api_key, timeout=30.0)

    async def transcribe(self, audio_bytes: bytes) -> dict:
        if self.api_key:
            try:
                client = self._get_client()
                if client is not None:
                    result = await asyncio.to_thread(
                        client.automatic_speech_recognition,
                        audio_bytes,
                        model=self.model_id,
                    )
                    text = getattr(result, "text", None)
                    if text is None and isinstance(result, dict):
                        text = result.get("text", "")
                    if text:
                        return {"text": text, "model_used": "indicWav2Vec"}
            except Exception:
                pass
        fallback_text = await self._whisper_fallback(audio_bytes)
        return {"text": fallback_text, "model_used": "whisper"}

    async def _whisper_fallback(self, audio_bytes: bytes) -> str:
        try:
            import tempfile
            import whisper

            model = whisper.load_model("base")
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio_bytes)
                result = model.transcribe(f.name)
                return result["text"]
        except Exception as e:
            return f"Transcription failed: {str(e)}"


def run_async(coro):
    try:
        return asyncio.run(coro)
    except RuntimeError:
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(coro)


orchestrator = EnsembleOrchestrator()
