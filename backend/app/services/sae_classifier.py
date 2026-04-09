"""M7 SAE classification + duplicate detection services."""

import json
import uuid
from typing import Any, Dict, List

from app.services.aikosh_client import IndicBERTClient, orchestrator
from app.services.knowledge_base import knowledge_base


def _parse_json(content: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _build_attr(primary_model: str, validator_model: str | None = None, ner_model: str | None = None) -> Dict[str, Any]:
    return {
        "primary_model": primary_model,
        "validator_model": validator_model,
        "ner_model": ner_model,
        "provider": "AIKosh India Sovereign AI Stack",
        "sovereign": primary_model != "nvidia-fallback",
    }


class SAESeverityClassifier:
    SEVERITY_CATEGORIES = {
        "DEATH": {"code": "CAT-01", "reporting_timeline": "7_days", "priority": 10, "keywords": ["death", "fatal", "died", "deceased", "mortality", "cause of death", "expired"]},
        "LIFE_THREATENING": {"code": "CAT-02", "reporting_timeline": "7_days", "priority": 9, "keywords": ["life-threatening", "icu", "resuscitation", "ventilator", "critical condition", "cardiac arrest", "anaphylaxis"]},
        "HOSPITALISATION": {"code": "CAT-03", "reporting_timeline": "15_days", "priority": 7, "keywords": ["hospitalised", "admitted", "inpatient", "emergency room", "prolonged hospitalisation", "er visit"]},
        "DISABILITY": {"code": "CAT-04", "reporting_timeline": "15_days", "priority": 7, "keywords": ["disability", "permanent impairment", "incapacitation", "inability to work", "paralysis", "blindness", "deafness"]},
        "CONGENITAL_ANOMALY": {"code": "CAT-05", "reporting_timeline": "15_days", "priority": 8, "keywords": ["congenital", "birth defect", "teratogenic", "fetal", "neonatal", "malformation"]},
        "MEDICALLY_SIGNIFICANT": {"code": "CAT-06", "reporting_timeline": "15_days", "priority": 5, "keywords": ["medically significant", "important medical event", "jeopardised patient"]},
        "OTHER": {"code": "CAT-07", "reporting_timeline": "15_days", "priority": 3, "keywords": []},
    }

    def __init__(self):
        self.indicbert = IndicBERTClient()

    async def classify(self, sae_text: str) -> Dict[str, Any]:
        seriousness_criteria = self._rule_based_check(sae_text)
        ner_entities = await self.indicbert.detect_entities(sae_text)
        ner_model = "indicbert" if ner_entities else None

        classifier_payload = await self._call_llm(
            prompt=f"""
            You are a CDSCO pharmacovigilance officer classifying an SAE report.
            Extract severity using ICH E2A / CDSCO categories.
            Rule-based triggers: {seriousness_criteria}
            Detected entities: {ner_entities[:10]}

            Return JSON with:
            - primary_category
            - secondary_categories
            - confidence
            - reporting_timeline
            - priority_score
            - classification_rationale
            - causality
            - product_relatedness
            - requires_expedited_reporting
            - flags

            SAE Report:
            {sae_text}
            """,
            role="classifier",
        )

        validator_payload = await self._call_llm(
            prompt=f"""
            Validate this SAE classification and return the final JSON using the same schema.

            Rule-based triggers: {seriousness_criteria}
            IndicBERT entities: {ner_entities[:10]}
            Proposed classification:
            {classifier_payload}

            SAE Report:
            {sae_text}
            """,
            role="validator",
        )

        final_payload = validator_payload or classifier_payload or {}
        final_payload["seriousness_criteria"] = seriousness_criteria
        final_payload["ner_entities"] = ner_entities[:10]
        final_payload["model_attribution"] = _build_attr(
            primary_model=validator_payload.get("_model_used", classifier_payload.get("_model_used", "nvidia-fallback")),
            validator_model=classifier_payload.get("_model_used"),
            ner_model=ner_model,
        )
        return final_payload

    async def _call_llm(self, prompt: str, role: str) -> Dict[str, Any]:
        result = await orchestrator.call(
            group_name="sae_classification",
            role=role,
            system_prompt="Return valid JSON only for SAE severity classification.",
            prompt=prompt,
            temperature=0.0,
            max_tokens=1200,
        )
        payload = _parse_json(result.get("content", ""))
        payload["_model_used"] = result.get("model_used", "nvidia-fallback")
        return payload

    def _rule_based_check(self, text: str) -> List[str]:
        text_lower = text.lower()
        triggered = []
        for category, config in self.SEVERITY_CATEGORIES.items():
            if any(kw in text_lower for kw in config["keywords"]):
                triggered.append(category)
        return triggered


class DuplicateDetectionEngine:
    def __init__(self, kb_or_client):
        self.kb = kb_or_client if hasattr(kb_or_client, "client") else None
        self._client = kb_or_client if hasattr(kb_or_client, "get_or_create_collection") else None
        self._collection = None

    @property
    def collection(self):
        if self._collection is None:
            client = self._client or self.kb.client
            self._collection = client.get_or_create_collection("sae_cases")
        return self._collection

    async def check_duplicate(self, sae_case: Dict) -> Dict[str, Any]:
        fingerprint = self._create_case_fingerprint(sae_case)
        results = self.collection.query(
            query_texts=[fingerprint],
            n_results=5,
            include=["documents", "distances", "metadatas"],
        )
        duplicates = []
        docs = results.get("documents", [[]])[0]
        dists = results.get("distances", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        for i, doc in enumerate(docs):
            similarity = 1 - dists[i]
            if similarity > 0.75:
                score = await self._score_duplicate(sae_case, doc)
                if score.get("duplicate_probability", 0) > 0.70:
                    duplicates.append(
                        {
                            "case_id": metas[i].get("case_id"),
                            "similarity_score": similarity,
                            "duplicate_probability": score.get("duplicate_probability", 0),
                            "matching_signals": score.get("matching_signals", []),
                            "recommendation": score.get("recommendation", "POSSIBLE_DUPLICATE"),
                        }
                    )
        case_id = sae_case.get("case_id", str(uuid.uuid4()))
        self.collection.add(documents=[fingerprint], metadatas=[{"case_id": case_id}], ids=[case_id])
        return {
            "is_potential_duplicate": len(duplicates) > 0,
            "potential_duplicates": duplicates,
            "duplicate_count": len(duplicates),
            "recommendation": "REVIEW_REQUIRED" if duplicates else "PROCEED",
            "model_attribution": {
                "primary_model": "chroma+rule-engine",
                "provider": "RegCheck duplicate detection engine",
                "sovereign": False,
            },
        }

    def _create_case_fingerprint(self, case: Dict) -> str:
        return f"""
        Product: {case.get('product_name', '')}
        Event: {case.get('event_description', '')[:200]}
        Patient age group: {case.get('age_group', '')}
        Gender: {case.get('gender', '')}
        Onset: {case.get('onset_date', '')}
        Outcome: {case.get('outcome', '')}
        """

    async def _score_duplicate(self, case1: Dict, case2_text: str) -> Dict[str, Any]:
        event1 = str(case1.get("event_description", "")).lower()[:100]
        event2 = case2_text.lower()[:200]
        overlap = 1.0 if event1 and event1 in event2 else 0.5 if event1 and any(w in event2 for w in event1.split()[:5]) else 0.2
        probability = min(0.95, max(0.1, overlap))
        return {
            "duplicate_probability": probability,
            "matching_signals": ["event_overlap"] if overlap >= 0.5 else [],
            "recommendation": "LIKELY_DUPLICATE" if probability > 0.8 else "POSSIBLE_DUPLICATE",
        }


class ReviewerPrioritisationEngine:
    def calculate_priority_score(self, sae_case: Dict) -> int:
        score = 0
        severity_scores = {
            "DEATH": 40, "LIFE_THREATENING": 35, "HOSPITALISATION": 25,
            "DISABILITY": 25, "CONGENITAL_ANOMALY": 30, "OTHER": 10,
        }
        score += severity_scores.get(sae_case.get("severity", "OTHER"), 10)
        days_to_deadline = sae_case.get("days_to_deadline", 30)
        if days_to_deadline <= 2:
            score += 30
        elif days_to_deadline <= 7:
            score += 20
        elif days_to_deadline <= 15:
            score += 10
        completeness = sae_case.get("completeness_score", 1.0)
        score += int((completeness - 1.0) * 20)
        if sae_case.get("is_potential_duplicate", False):
            score -= 15
        return max(0, min(100, score))


sae_classifier = SAESeverityClassifier()
duplicate_engine = DuplicateDetectionEngine(knowledge_base)
prioritisation_engine = ReviewerPrioritisationEngine()
