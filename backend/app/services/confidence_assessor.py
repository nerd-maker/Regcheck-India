"""
Multi-Signal Confidence System (Gap 2)

Replaces unreliable LLM self-assessment with 4 structural signals:
- Retrieval similarity (are KB chunks relevant?)
- Citation completeness (does output cite sources?)
- Schema validation (does output match expected structure?)
- LLM self-assessment (weighted lowest, kept as one signal)

Aggregation: ANY signal LOW → overall LOW → triggers review queue
"""

import logging
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────

class SignalResult(BaseModel):
    """Individual confidence signal result"""
    signal_name: str
    score: float  # 0.0-1.0
    level: str  # HIGH, MEDIUM, LOW
    details: str = ""
    weight: float = 0.25


class MultiSignalConfidence(BaseModel):
    """Aggregated confidence from all signals"""
    overall_score: float = 0.0
    overall_level: str = "LOW"  # HIGH, MEDIUM, LOW
    requires_review: bool = True
    signals: List[SignalResult] = Field(default_factory=list)
    aggregation_method: str = "weighted_with_floor"
    review_reasons: List[str] = Field(default_factory=list)


# ──────────────────────────────────────────────────────
# Confidence Assessor
# ──────────────────────────────────────────────────────

class MultiSignalConfidenceAssessor:
    """
    Computes confidence from 4 structural signals.

    Each signal is scored 0.0-1.0 and categorized HIGH/MEDIUM/LOW.
    ANY signal LOW → overall LOW → mandatory review.
    """

    SIGNAL_WEIGHTS = {
        "retrieval": 0.30,
        "citation": 0.25,
        "schema": 0.25,
        "llm_self": 0.20,  # Lowest weight — LLM self-assessment is unreliable
    }

    def assess(
        self,
        retrieval_scores: List[float],
        citations_found: int,
        citations_expected: int,
        schema_valid: bool,
        schema_fields_present: int,
        schema_fields_total: int,
        llm_confidence: float,
        min_retrieval_threshold: float = 0.65
    ) -> MultiSignalConfidence:
        """
        Compute multi-signal confidence.

        Args:
            retrieval_scores: Similarity scores from KB retrieval
            citations_found: How many regulatory citations in output
            citations_expected: How many should be there
            schema_valid: Whether output passes schema validation
            schema_fields_present: Fields populated in output
            schema_fields_total: Total expected fields
            llm_confidence: LLM's own confidence (0.0-1.0)
            min_retrieval_threshold: Minimum similarity for relevance
        """
        signals = []
        review_reasons = []

        # Signal 1: Retrieval Confidence
        retrieval = self._assess_retrieval(retrieval_scores, min_retrieval_threshold)
        signals.append(retrieval)
        if retrieval.level == "LOW":
            review_reasons.append(f"Low retrieval relevance: {retrieval.details}")

        # Signal 2: Citation Completeness
        citation = self._assess_citation(citations_found, citations_expected)
        signals.append(citation)
        if citation.level == "LOW":
            review_reasons.append(f"Missing citations: {citation.details}")

        # Signal 3: Schema Validation
        schema = self._assess_schema(schema_valid, schema_fields_present, schema_fields_total)
        signals.append(schema)
        if schema.level == "LOW":
            review_reasons.append(f"Schema issues: {schema.details}")

        # Signal 4: LLM Self-Assessment (lowest weight)
        llm = self._assess_llm(llm_confidence)
        signals.append(llm)
        if llm.level == "LOW":
            review_reasons.append(f"LLM low self-confidence: {llm.details}")

        # Aggregation: weighted average WITH floor rule
        weighted_score = sum(s.score * s.weight for s in signals)
        any_low = any(s.level == "LOW" for s in signals)

        if any_low:
            overall_level = "LOW"
            requires_review = True
        elif weighted_score >= 0.85:
            overall_level = "HIGH"
            requires_review = False
        elif weighted_score >= 0.70:
            overall_level = "MEDIUM"
            requires_review = False
        else:
            overall_level = "LOW"
            requires_review = True

        return MultiSignalConfidence(
            overall_score=round(weighted_score, 3),
            overall_level=overall_level,
            requires_review=requires_review,
            signals=signals,
            review_reasons=review_reasons
        )

    # ── Individual Signal Assessments ──

    def _assess_retrieval(
        self,
        scores: List[float],
        threshold: float
    ) -> SignalResult:
        """Signal 1: Are retrieved KB chunks relevant?"""
        if not scores:
            return SignalResult(
                signal_name="retrieval",
                score=0.0,
                level="LOW",
                details="No retrieval results",
                weight=self.SIGNAL_WEIGHTS["retrieval"]
            )

        avg_score = sum(scores) / len(scores)
        above_threshold = sum(1 for s in scores if s >= threshold)
        ratio = above_threshold / len(scores)

        if avg_score >= 0.80 and ratio >= 0.7:
            level = "HIGH"
        elif avg_score >= 0.65 and ratio >= 0.5:
            level = "MEDIUM"
        else:
            level = "LOW"

        return SignalResult(
            signal_name="retrieval",
            score=round(avg_score, 3),
            level=level,
            details=f"Avg similarity: {avg_score:.2f}, {above_threshold}/{len(scores)} above threshold",
            weight=self.SIGNAL_WEIGHTS["retrieval"]
        )

    def _assess_citation(
        self,
        found: int,
        expected: int
    ) -> SignalResult:
        """Signal 2: Does output cite regulatory sources?"""
        if expected == 0:
            return SignalResult(
                signal_name="citation",
                score=1.0,
                level="HIGH",
                details="No citations expected",
                weight=self.SIGNAL_WEIGHTS["citation"]
            )

        ratio = found / expected
        score = min(ratio, 1.0)

        if ratio >= 0.8:
            level = "HIGH"
        elif ratio >= 0.5:
            level = "MEDIUM"
        else:
            level = "LOW"

        return SignalResult(
            signal_name="citation",
            score=round(score, 3),
            level=level,
            details=f"{found}/{expected} citations found",
            weight=self.SIGNAL_WEIGHTS["citation"]
        )

    def _assess_schema(
        self,
        valid: bool,
        fields_present: int,
        fields_total: int
    ) -> SignalResult:
        """Signal 3: Does output match expected schema?"""
        if fields_total == 0:
            field_ratio = 1.0
        else:
            field_ratio = fields_present / fields_total

        if valid and field_ratio >= 0.9:
            level = "HIGH"
            score = field_ratio
        elif valid and field_ratio >= 0.7:
            level = "MEDIUM"
            score = field_ratio
        else:
            level = "LOW"
            score = field_ratio * 0.5 if not valid else field_ratio

        return SignalResult(
            signal_name="schema",
            score=round(score, 3),
            level=level,
            details=f"Valid: {valid}, fields: {fields_present}/{fields_total}",
            weight=self.SIGNAL_WEIGHTS["schema"]
        )

    def _assess_llm(self, confidence: float) -> SignalResult:
        """Signal 4: LLM self-assessment (lowest weight)."""
        if confidence >= 0.85:
            level = "HIGH"
        elif confidence >= 0.65:
            level = "MEDIUM"
        else:
            level = "LOW"

        return SignalResult(
            signal_name="llm_self",
            score=round(confidence, 3),
            level=level,
            details=f"LLM self-confidence: {confidence:.2f}",
            weight=self.SIGNAL_WEIGHTS["llm_self"]
        )


# Global instance
confidence_assessor = MultiSignalConfidenceAssessor()
