"""
Centralized Anthropic Claude client for RegCheck-India.

Provides a single `call_claude()` helper used by all services.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
from fastapi import HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Module-level singleton
_client: Optional[anthropic.Anthropic] = None

# Model constants — read ANTHROPIC_MODEL env vars with hardcoded Claude defaults
MODEL_SONNET = os.getenv("ANTHROPIC_MODEL",      "claude-sonnet-4-6")
MODEL_HAIKU  = os.getenv("ANTHROPIC_MODEL_FAST", "claude-haiku-4-5-20251001")


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


# ---------------------------------------------------------------------------
# AgentResponse and helper definitions for AI compliance agents
# ---------------------------------------------------------------------------

class AgentResponse(BaseModel):
    agent: str
    model: str
    result: Any
    timestamp: str
    token_usage: dict


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_json_block(raw_text: str) -> Any:
    text = raw_text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Model did not return valid JSON: {exc}",
        )


def _attach_response_metadata(parsed: Any, model: str, has_rag_context: bool) -> Any:
    if not isinstance(parsed, dict):
        return parsed
    try:
        has_context = bool(has_rag_context)
        parsed["_metadata"] = {
            "confidence_level": "HIGH" if has_context else "MEDIUM",
            "confidence_reason": (
                "Based on retrieved official regulatory documents"
                if has_context
                else "Based on Claude's training knowledge of regulations"
            ),
            "reviewed_by": "AI — requires qualified RA professional review",
            "generated_at": datetime.utcnow().isoformat(),
            "model_used": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        }
    except Exception as meta_err:
        logger.warning("Could not set metadata: %s", meta_err)
        parsed["_metadata"] = {
            "confidence_level": "MEDIUM",
            "confidence_reason": "Based on Claude's training knowledge of regulations",
            "reviewed_by": "AI — requires qualified RA professional review",
            "generated_at": datetime.utcnow().isoformat(),
            "model_used": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        }
    return parsed


def call_claude_agent(
    agent_name: str,
    model: str,
    system_prompt: str,
    user_content: str,
    api_key: str,
    max_tokens: int = 4096,
    has_rag_context: bool = False,
) -> AgentResponse:
    """Shared Anthropic caller for all compliance agents.

    api_key == "admin-regcheck" → use server ANTHROPIC_API_KEY env var.
    Any other non-empty string   → use as the caller's own API key.
    Empty string                 → 401.
    """
    admin_password = "admin-regcheck"
    if api_key == admin_password:
        server_key = os.getenv("ANTHROPIC_API_KEY")
        if not server_key:
            raise HTTPException(status_code=500, detail="Server Anthropic API key missing.")
        client = anthropic.Anthropic(api_key=server_key)
    else:
        if not api_key:
            raise HTTPException(
                status_code=401,
                detail="No Anthropic API key provided. Add your key via the ⚙ Settings panel in the app.",
            )
        client = anthropic.Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        )
        raw_text = response.content[0].text.strip()
        parsed = _attach_response_metadata(
            _parse_json_block(raw_text),
            model,
            has_rag_context,
        )
        return AgentResponse(
            agent=agent_name,
            model=model,
            result=parsed,
            timestamp=_utc_timestamp(),
            token_usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )
    except anthropic.AuthenticationError:
        logger.error("Anthropic auth failed for %s", agent_name)
        raise HTTPException(
            status_code=401,
            detail="Anthropic API key is invalid. Please check and update your key in Settings.",
        )
    except anthropic.RateLimitError:
        logger.warning("Anthropic rate limit hit for %s", agent_name)
        raise HTTPException(status_code=429, detail="Rate limit reached - retry after a moment")
    except anthropic.APIError as exc:
        logger.error("Anthropic API error in %s: %s", agent_name, exc)
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {exc}")
    except Exception as exc:
        logger.error("Unexpected error in %s: %s", agent_name, exc)
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}")


def structure_prompt_input(text: str, document_type: str = "general", agent_id: str = "") -> str:
    """Convert raw text input into a structured format before sending to Claude.

    Reduces token cost, improves accuracy, strips unnecessary whitespace.
    """
    cleaned = " ".join(text.split())  # normalize whitespace
    word_count = len(cleaned.split())

    if word_count > 5000:
        words = cleaned.split()
        cleaned = " ".join(words[:5000])
        truncated = True
    else:
        truncated = False

    return (
        f"[INPUT DOCUMENT]\n"
        f"Document Type: {document_type}\n"
        f"Word Count: {word_count}"
        f'{"  [TRUNCATED TO 5000 WORDS]" if truncated else ""}\n'
        f"Agent: {agent_id}\n\n"
        f"[CONTENT]\n{cleaned}\n\n[END OF INPUT]"
    )
