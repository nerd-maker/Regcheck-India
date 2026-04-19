"""
LLM Configuration for Production Safety Rules
Enforces temperature settings, token budgets, classification confidence,
review queue SLA, and commitment tracking per module.

Gap 9: Temperature 0.0 for M1/M4 (minimizes randomness)
Gap 11: Classification confidence threshold
Gap 12: Review queue SLA configuration
Gap 16: Commitment tracking alerts
"""

import os
from typing import Dict, List


class LLMConfig:
    """
    Production-grade LLM configuration enforcing:
    - Rule 5: Temperature Settings per module
    - Rule 6: Max Token Budgets per operation
    - Gap 9: Temperature 0.0 for deterministic modules
    - Gap 11: Classification confidence thresholds
    - Gap 12: Review queue SLA
    """

    # Rule 5 + Gap 9: Temperature Settings
    # Gap 9: M1 and M4 set to 0.0 for maximum determinism
    MODULE_TEMPERATURES: Dict[str, float] = {
        "M1_COMPLIANCE": 0.0,       # Gap 9: 0.0 for deterministic compliance
        "M2_GENERATION": 0.3,       # Slightly creative for narrative sections
        "M3_QUERY": 0.2,            # Balanced for query responses
        "M3_CLASSIFICATION": 0.0,   # Gap 11: Deterministic classification
        "M4_INTELLIGENCE": 0.0,     # Gap 9: 0.0 for deterministic analysis
        "M4_INGESTION": 0.0,        # Gap 9: Alias for M4 ingestion operations
        "M4_DIGEST": 0.0,           # Gap 9: Alias for M4 digest operations
    }

    # Rule 6: Max Token Budgets
    MODULE_MAX_TOKENS: Dict[str, int] = {
        "M1_SECTION_EVAL": 2000,    # Per section evaluation
        "M2_SECTION_GEN": 3000,     # Per section generated
        "M3_QUERY_RESPONSE": 2500,  # Per query response
        "M3_CLASSIFICATION": 1500,  # Gap 11: Classification tokens
        "M4_INGESTION": 4000,       # Document ingestion
        "M4_DIGEST": 3000,          # Weekly digest
    }

    # LLM model (Anthropic Claude) — prefer ANTHROPIC_MODEL, fall back to LLM_MODEL for legacy
    LLM_MODEL      = os.getenv("ANTHROPIC_MODEL",      os.getenv("LLM_MODEL",      "claude-sonnet-4-20250514"))
    LLM_MODEL_FAST = os.getenv("ANTHROPIC_MODEL_FAST", os.getenv("LLM_MODEL_FAST", "claude-haiku-4-20250414"))

    # --- Gap 11: M3 Classification Confidence ---
    CLASSIFICATION_CONFIDENCE_THRESHOLD: float = 0.75

    HIGH_STAKES_CATEGORIES: List[str] = [
        "CAT-07",  # Pharmacovigilance (SAE reporting)
        "CAT-09",  # Regulatory Compliance (CDSCO)
        "CAT-12",  # Insurance/Compensation
    ]

    TOP_CANDIDATES_COUNT: int = 2
    MINIMUM_SUGGESTION_CONFIDENCE: float = 0.30

    # --- Gap 12: Review Queue SLA ---
    REVIEW_QUEUE_SLA_HOURS: int = 2  # Flag to customer within 2 hours

    REVIEW_QUEUE_ALERT_DAYS: Dict[str, int] = {
        "T_14": 14,  # Email to RA team lead
        "T_7": 7,    # Email + in-app banner
        "T_3": 3,    # Senior management + daily reminders
        "T_0": 0,    # Lock item, require override
    }

    PRIORITY_THRESHOLDS: Dict[str, int] = {
        "CRITICAL": 3,   # <=3 days
        "HIGH": 7,       # 4-7 days
        "MEDIUM": 14,    # 8-14 days
        # >14 days = LOW
    }

    # --- Gap 14: Ground Truth Validation ---
    PRECISION_TARGET: float = 0.80
    RECALL_TARGET: float = 0.75

    # --- Gap 15: Cross-Reference Context ---
    CRITICAL_CROSS_REFERENCES: List[str] = [
        "primary_endpoint",
        "sample_size",
        "randomization_procedure",
        "primary_analysis",
        "sae_definition",
    ]

    # --- Gap 16: Commitment Tracking ---
    COMMITMENT_ALERT_DAYS: List[int] = [7, 2]  # T-7 and T-2 alerts
    COMMITMENT_EDIT_SIMILARITY_THRESHOLD: float = 0.70

    @classmethod
    def get_temperature(cls, module: str) -> float:
        """Get temperature for specific module"""
        temp = cls.MODULE_TEMPERATURES.get(module)
        if temp is None:
            raise ValueError(f"Unknown module: {module}")
        return temp

    @classmethod
    def get_max_tokens(cls, operation: str) -> int:
        """Get max tokens for specific operation"""
        tokens = cls.MODULE_MAX_TOKENS.get(operation)
        if tokens is None:
            raise ValueError(f"Unknown operation: {operation}")
        return tokens

    @classmethod
    def validate_token_usage(cls, operation: str, actual_tokens: int) -> bool:
        """Check if token usage is within budget"""
        budget = cls.get_max_tokens(operation)
        return actual_tokens <= budget

    @classmethod
    def is_high_stakes_category(cls, category_id: str) -> bool:
        """Check if category requires mandatory human confirmation"""
        return category_id in cls.HIGH_STAKES_CATEGORIES

    @classmethod
    def compute_review_priority(cls, days_until_deadline: int) -> str:
        """Compute review queue priority based on deadline proximity"""
        if days_until_deadline <= cls.PRIORITY_THRESHOLDS["CRITICAL"]:
            return "CRITICAL"
        elif days_until_deadline <= cls.PRIORITY_THRESHOLDS["HIGH"]:
            return "HIGH"
        elif days_until_deadline <= cls.PRIORITY_THRESHOLDS["MEDIUM"]:
            return "MEDIUM"
        return "LOW"
