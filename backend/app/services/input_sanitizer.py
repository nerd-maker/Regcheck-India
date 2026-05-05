"""
Input sanitization for RegCheck-India.
Protects against prompt injection attacks in document submissions.
"""

import re
import logging

logger = logging.getLogger(__name__)

# Patterns that suggest prompt injection attempts
INJECTION_PATTERNS = [
    # Direct instruction injection
    re.compile(r'ignore\s+(all\s+)?previous\s+instructions?', re.IGNORECASE),
    re.compile(r'disregard\s+(all\s+)?previous\s+instructions?', re.IGNORECASE),
    re.compile(r'forget\s+(all\s+)?previous\s+instructions?', re.IGNORECASE),
    re.compile(r'you\s+are\s+now\s+a?\s+\w+', re.IGNORECASE),
    re.compile(r'act\s+as\s+(if\s+you\s+are\s+)?(a\s+)?\w+', re.IGNORECASE),
    # System prompt manipulation
    re.compile(r'\[SYSTEM\]', re.IGNORECASE),
    re.compile(r'<system>', re.IGNORECASE),
    re.compile(r'###\s*system', re.IGNORECASE),
    re.compile(r'###\s*instruction', re.IGNORECASE),
    # Role manipulation
    re.compile(r'you\s+are\s+DAN', re.IGNORECASE),
    re.compile(r'jailbreak', re.IGNORECASE),
    re.compile(r'do\s+anything\s+now', re.IGNORECASE),
    # Data exfiltration attempts
    re.compile(r'reveal\s+your\s+(system\s+)?prompt', re.IGNORECASE),
    re.compile(r'print\s+your\s+instructions', re.IGNORECASE),
    re.compile(r'show\s+me\s+your\s+system\s+prompt', re.IGNORECASE),
]

# Suspicious but not definitive — just log these
SUSPICIOUS_PATTERNS = [
    re.compile(r'<\|.*?\|>', re.IGNORECASE),  # token-like patterns
    re.compile(r'\[\[.*?\]\]'),                 # double bracket injection
    re.compile(r'ASSISTANT:', re.IGNORECASE),
    re.compile(r'USER:', re.IGNORECASE),
    re.compile(r'HUMAN:', re.IGNORECASE),
]


def sanitize_input(text: str, context: str = "") -> tuple[str, bool]:
    """
    Sanitize user input text.
    
    Returns:
        (sanitized_text, was_modified)
    
    Raises:
        ValueError if definitive injection attempt detected
    """
    if not text:
        return text, False

    # Check for definitive injection attempts
    for pattern in INJECTION_PATTERNS:
        if pattern.search(text):
            logger.warning(
                f"Prompt injection attempt detected in {context}: "
                f"pattern={pattern.pattern[:50]}"
            )
            raise ValueError(
                "Input contains content that cannot be processed. "
                "Please submit a valid regulatory document."
            )

    # Log suspicious patterns but don't block
    for pattern in SUSPICIOUS_PATTERNS:
        if pattern.search(text):
            logger.warning(
                f"Suspicious pattern in {context}: "
                f"pattern={pattern.pattern[:50]}"
            )

    # Sanitize control characters that could manipulate prompts
    sanitized = text

    # Remove null bytes
    sanitized = sanitized.replace('\x00', '')

    # Remove non-printable control characters except newlines and tabs
    sanitized = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', sanitized)

    # Limit consecutive newlines to 3 (prevents prompt structure manipulation)
    sanitized = re.sub(r'\n{4,}', '\n\n\n', sanitized)

    was_modified = sanitized != text
    if was_modified:
        logger.info(f"Input sanitized for {context} — removed control characters")

    return sanitized, was_modified
