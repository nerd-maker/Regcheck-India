"""
Centralized Anthropic Claude client for RegCheck-India.

Provides a single `call_claude()` helper used by all services.
"""

import json
import logging
import os
from typing import Optional

import anthropic

logger = logging.getLogger(__name__)

# Module-level singleton
_client: Optional[anthropic.Anthropic] = None

# Model constants
MODEL_SONNET = "claude-sonnet-4-20250514"
MODEL_HAIKU = "claude-haiku-4-20250414"


def get_claude_client() -> anthropic.Anthropic:
    """Return a singleton Anthropic client."""
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def call_claude(
    prompt: str,
    system_prompt: str = "",
    model: str = MODEL_SONNET,
    max_tokens: int = 2000,
    temperature: float = 0.0,
) -> dict:
    """
    Unified Claude API call.

    Returns:
        {
            "content": str,         # The text response
            "model": str,           # Model ID used
            "usage": {
                "input_tokens": int,
                "output_tokens": int,
            },
        }
    """
    client = get_claude_client()

    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system_prompt:
        kwargs["system"] = system_prompt
    if temperature > 0:
        kwargs["temperature"] = temperature

    try:
        response = client.messages.create(**kwargs)
    except anthropic.APIError as exc:
        logger.error("Claude API error: %s", exc)
        raise

    content = ""
    if hasattr(response, "content"):
        blocks = response.content
        if isinstance(blocks, list) and blocks:
            first = blocks[0]
            content = getattr(first, "text", "") or ""
        elif isinstance(blocks, str):
            content = blocks
    if not content and hasattr(response, "choices"):
        try:
            content = response.choices[0].message.content
        except Exception:
            content = ""

    usage = getattr(response, "usage", None)
    return {
        "content": content,
        "model": model,
        "usage": {
            "input_tokens": getattr(usage, "input_tokens", getattr(usage, "prompt_tokens", 0)),
            "output_tokens": getattr(usage, "output_tokens", getattr(usage, "completion_tokens", 0)),
        },
    }


def parse_claude_json(raw: str) -> dict:
    """Extract JSON from a Claude response, handling markdown fences."""
    text = raw.strip()

    # Strip ```json ... ``` blocks
    if "```json" in text:
        start = text.find("```json") + 7
        end = text.find("```", start)
        text = text[start:end].strip()
    elif "```" in text:
        start = text.find("```") + 3
        end = text.find("```", start)
        text = text[start:end].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Last resort: find outermost braces
        brace_start = text.find("{")
        brace_end = text.rfind("}") + 1
        if brace_start != -1 and brace_end > brace_start:
            return json.loads(text[brace_start:brace_end])
        raise
