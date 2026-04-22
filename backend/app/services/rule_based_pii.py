"""
Rule-based PII detection layer for RegCheck-India M1.
Runs before Claude LLM to catch deterministic PII patterns.
Implements hybrid approach as required by CDSCO AI hackathon guidelines.
"""

import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class RuleBasedMatch:
    entity_type: str
    value: str
    category: str  # PII or PHI
    position: str
    rule_name: str
    confidence: str  # HIGH, MEDIUM


# ─────────────────────────────────────────────
# INDIAN-SPECIFIC PII PATTERNS
# ─────────────────────────────────────────────
PATTERNS = {

    # Indian phone numbers
    "PHONE_NUMBER": {
        "pattern": r"\b(?:\+91[-\s]?)?(?:[6-9]\d{9})\b",
        "category": "PII",
        "confidence": "HIGH",
        "description": "Indian mobile/phone number"
    },

    # Email addresses
    "EMAIL_ADDRESS": {
        "pattern": r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
        "category": "PII",
        "confidence": "HIGH",
        "description": "Email address"
    },

    # Aadhaar number (12 digits, may be spaced)
    "AADHAAR_NUMBER": {
        "pattern": r"\b[2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}\b",
        "category": "PII",
        "confidence": "HIGH",
        "description": "Aadhaar number"
    },

    # PAN card
    "PAN_NUMBER": {
        "pattern": r"\b[A-Z]{5}[0-9]{4}[A-Z]\b",
        "category": "PII",
        "confidence": "HIGH",
        "description": "PAN card number"
    },

    # Indian passport
    "PASSPORT_NUMBER": {
        "pattern": r"\b[A-PR-WYa-pr-wy][1-9]\d{7}\b",
        "category": "PII",
        "confidence": "MEDIUM",
        "description": "Indian passport number"
    },

    # Date of birth patterns
    "DATE_OF_BIRTH": {
        "pattern": r"\b(?:DOB|D\.O\.B|Date of Birth|Born on|born)[\s:]+\d{1,2}[-/\s]\w+[-/\s]\d{2,4}\b",
        "category": "PII",
        "confidence": "HIGH",
        "description": "Date of birth"
    },

    # General dates (dd-Mon-yyyy or dd/mm/yyyy)
    "DATE": {
        "pattern": r"\b\d{1,2}[-/]\w{3,9}[-/]\d{2,4}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b",
        "category": "PII",
        "confidence": "MEDIUM",
        "description": "Date value"
    },

    # Patient ID / Subject ID patterns common in clinical trials
    "PATIENT_ID": {
        "pattern": r"\b(?:Patient|Subject|Pt|Sub)[\s\.\-#:]+(?:ID|No|Number|Code)?[\s:]*([A-Z0-9\-]{3,20})\b",
        "category": "PII",
        "confidence": "HIGH",
        "description": "Patient/Subject identifier"
    },

    # Indian PIN codes
    "PIN_CODE": {
        "pattern": r"\b[1-9][0-9]{5}\b",
        "category": "PHI",
        "confidence": "MEDIUM",
        "description": "Indian PIN code"
    },

    # Hospital registration numbers
    "HOSPITAL_REGISTRATION": {
        "pattern": r"\b(?:Reg|Registration|MRN|HRN)[\s\.\-#:]+(?:No|Number)?[\s:]*([A-Z0-9\-\/]{4,20})\b",
        "category": "PHI",
        "confidence": "MEDIUM",
        "description": "Hospital registration number"
    },

    # Doctor/Investigator registration (MCI)
    "DOCTOR_REGISTRATION": {
        "pattern": r"\b(?:MCI|IMC|SMC|Registration)[\s\.\-#:]*(?:No|Number)?[\s:]*([A-Z0-9\-\/]{4,20})\b",
        "category": "PHI",
        "confidence": "MEDIUM",
        "description": "Medical Council registration"
    },

    # IP address
    "IP_ADDRESS": {
        "pattern": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        "category": "PII",
        "confidence": "HIGH",
        "description": "IP address"
    },

    # Indian bank account (basic pattern)
    "BANK_ACCOUNT": {
        "pattern": r"\b\d{9,18}\b(?=.*(?:account|acc|bank))",
        "category": "PII",
        "confidence": "MEDIUM",
        "description": "Bank account number"
    },
}

# Name prefixes for detecting person names
NAME_PREFIXES = [
    "Mr", "Mrs", "Ms", "Miss", "Dr", "Prof", "Er",
    "Shri", "Smt", "Ku", "Sri", "Srimati",
    "Mr.", "Mrs.", "Ms.", "Dr.", "Prof."
]

NAME_PREFIX_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(p) for p in NAME_PREFIXES) + r")\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b"
)


def detect_pii(text: str) -> list[RuleBasedMatch]:
    """
    Run rule-based PII detection on input text.
    Returns list of RuleBasedMatch objects.
    """
    matches = []
    lines = text.split('\n')

    # Run regex patterns
    for entity_type, config in PATTERNS.items():
        pattern = re.compile(config["pattern"], re.IGNORECASE)
        for match in pattern.finditer(text):
            # Find which line this match is on
            char_pos = match.start()
            line_num = text[:char_pos].count('\n') + 1

            matches.append(RuleBasedMatch(
                entity_type=entity_type,
                value=match.group(0),
                category=config["category"],
                position=f"Line {line_num}",
                rule_name=config["description"],
                confidence=config["confidence"]
            ))

    # Name detection using prefix patterns
    for match in NAME_PREFIX_PATTERN.finditer(text):
        char_pos = match.start()
        line_num = text[:char_pos].count('\n') + 1
        full_name = match.group(0)

        matches.append(RuleBasedMatch(
            entity_type="PERSON_NAME",
            value=full_name,
            category="PII",
            position=f"Line {line_num}",
            rule_name="Name with honorific prefix",
            confidence="HIGH"
        ))

    # Deduplicate overlapping matches
    matches = _deduplicate(matches)

    return matches


def get_pii_summary(matches: list[RuleBasedMatch]) -> dict:
    """Summarise detected PII by category and type."""
    summary = {
        "total_detections": len(matches),
        "pii_count": sum(1 for m in matches if m.category == "PII"),
        "phi_count": sum(1 for m in matches if m.category == "PHI"),
        "high_confidence": sum(1 for m in matches if m.confidence == "HIGH"),
        "by_type": {}
    }
    for match in matches:
        if match.entity_type not in summary["by_type"]:
            summary["by_type"][match.entity_type] = 0
        summary["by_type"][match.entity_type] += 1
    return summary


def _deduplicate(matches: list[RuleBasedMatch]) -> list[RuleBasedMatch]:
    """Remove duplicate matches with same value and entity type."""
    seen = set()
    unique = []
    for match in matches:
        key = (match.entity_type, match.value.strip().lower())
        if key not in seen:
            seen.add(key)
            unique.append(match)
    return unique


def format_for_response(matches: list[RuleBasedMatch]) -> list[dict]:
    """Format matches for API response."""
    return [
        {
            "entity_type": m.entity_type,
            "value": m.value,
            "category": m.category,
            "position": m.position,
            "detection_method": "RULE_BASED",
            "confidence": m.confidence,
            "rule": m.rule_name
        }
        for m in matches
    ]
