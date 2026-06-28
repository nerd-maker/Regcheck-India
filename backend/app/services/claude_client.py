"""
Centralized Anthropic Claude client for RegCheck-India.

Provides a single `call_claude()` helper used by all services.

ASYNC: All Claude calls use AsyncAnthropic so the event loop is never
blocked during a 4-15 s model response. FastAPI can serve other requests
concurrently while one agent call is in flight.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
from fastapi import HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model constants
# ---------------------------------------------------------------------------
MODEL_SONNET = os.getenv("ANTHROPIC_MODEL",      "claude-sonnet-4-6")
MODEL_HAIKU  = os.getenv("ANTHROPIC_MODEL_FAST", "claude-haiku-4-5-20251001")

# ---------------------------------------------------------------------------
# Cost table (USD per million tokens, as of 2025-06)
# Used for cost_usd tracking on every agent call.
# ---------------------------------------------------------------------------
_COST_TABLE: dict[str, dict[str, float]] = {
    "claude-sonnet-4-6":         {"input": 3.00,  "output": 15.00},
    "claude-haiku-4-5-20251001": {"input": 0.25,  "output":  1.25},
    # Fallback for unknown models
    "_default":                   {"input": 3.00,  "output": 15.00},
}


def compute_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """Return estimated USD cost for a Claude call."""
    pricing = _COST_TABLE.get(model, _COST_TABLE["_default"])
    return round(
        (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000,
        6,
    )


# ---------------------------------------------------------------------------
# Async singleton client  (replaces the old sync singleton)
# ---------------------------------------------------------------------------
_async_client: Optional[anthropic.AsyncAnthropic] = None


def get_async_claude_client(api_key: str = "") -> anthropic.AsyncAnthropic:
    """Return a per-call AsyncAnthropic client.

    Uses a module-level singleton when api_key is the server key;
    otherwise creates a short-lived client for the caller's key.
    """
    global _async_client
    resolved_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
    server_key   = os.getenv("ANTHROPIC_API_KEY", "")

    if resolved_key == server_key:
        # Reuse singleton for server-key calls
        if _async_client is None:
            _async_client = anthropic.AsyncAnthropic(api_key=resolved_key)
        return _async_client

    # Caller supplied their own key — fresh lightweight client
    return anthropic.AsyncAnthropic(api_key=resolved_key)


# ---------------------------------------------------------------------------
# Synchronous helper kept for legacy non-async call sites (e.g. query_response_generator)
# ---------------------------------------------------------------------------
_sync_client: Optional[anthropic.Anthropic] = None


def get_claude_client() -> anthropic.Anthropic:
    """Return a singleton synchronous Anthropic client (legacy callers only)."""
    global _sync_client
    if _sync_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        _sync_client = anthropic.Anthropic(api_key=api_key)
    return _sync_client


async def call_claude(
    prompt: str,
    system_prompt: str = "",
    model: str = MODEL_SONNET,
    max_tokens: int = 2000,
    temperature: float = 0.0,
) -> dict:
    """Unified async Claude API call.

    Returns:
        {
            "content": str,
            "model": str,
            "usage": {"input_tokens": int, "output_tokens": int},
            "cost_usd": float,
            "generation_time_seconds": float,
        }
    """
    client = get_async_claude_client()

    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system_prompt:
        kwargs["system"] = system_prompt
    if temperature > 0:
        kwargs["temperature"] = temperature

    t0 = time.perf_counter()
    try:
        response = await client.messages.create(**kwargs)
    except anthropic.APIError as exc:
        logger.error("Claude API error: %s", exc)
        raise
    elapsed = time.perf_counter() - t0

    content = ""
    if hasattr(response, "content"):
        blocks = response.content
        if isinstance(blocks, list) and blocks:
            content = getattr(blocks[0], "text", "") or ""
        elif isinstance(blocks, str):
            content = blocks

    usage = getattr(response, "usage", None)
    in_tok  = getattr(usage, "input_tokens",  0)
    out_tok = getattr(usage, "output_tokens", 0)

    if not isinstance(in_tok, (int, float)):
        in_tok = 0
    if not isinstance(out_tok, (int, float)):
        out_tok = 0

    return {
        "content": content,
        "model": model,
        "usage": {"input_tokens": in_tok, "output_tokens": out_tok},
        "cost_usd": compute_cost_usd(model, in_tok, out_tok),
        "generation_time_seconds": round(elapsed, 3),
    }


def parse_claude_json(raw: str) -> dict:
    """Extract JSON from a Claude response, handling markdown fences."""
    text = raw.strip()
    if "```json" in text:
        start = text.find("```json") + 7
        end   = text.find("```", start)
        text  = text[start:end].strip()
    elif "```" in text:
        start = text.find("```") + 3
        end   = text.find("```", start)
        text  = text[start:end].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        brace_start = text.find("{")
        brace_end   = text.rfind("}") + 1
        if brace_start != -1 and brace_end > brace_start:
            return json.loads(text[brace_start:brace_end])
        raise


# ---------------------------------------------------------------------------
# AgentResponse and helpers for compliance agents
# ---------------------------------------------------------------------------

class AgentResponse(BaseModel):
    agent: str
    model: str
    result: Any
    timestamp: str
    token_usage: dict
    cost_usd: float = 0.0
    generation_time_seconds: float = 0.0


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
            "model_used": model,
        }
    except Exception as meta_err:
        logger.warning("Could not set metadata: %s", meta_err)
        parsed["_metadata"] = {
            "confidence_level": "MEDIUM",
            "confidence_reason": "Based on Claude's training knowledge of regulations",
            "reviewed_by": "AI — requires qualified RA professional review",
            "generated_at": datetime.utcnow().isoformat(),
            "model_used": model,
        }
    return parsed


async def call_claude_agent(
    agent_name: str,
    model: str,
    system_prompt: str,
    user_content: str,
    api_key: str,
    max_tokens: int = 4096,
    has_rag_context: bool = False,
) -> AgentResponse:
    """Async Anthropic caller for all compliance agents.

    api_key == ADMIN_DEMO_KEY  → use server ANTHROPIC_API_KEY env var.
    Any other non-empty string → use as the caller's own API key.
    Empty string               → 401.
    """
    admin_password = os.getenv("ADMIN_DEMO_KEY", "")
    if admin_password and api_key == admin_password:
        resolved_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not resolved_key:
            raise HTTPException(status_code=500, detail="Server Anthropic API key missing.")
    else:
        if not api_key:
            raise HTTPException(
                status_code=401,
                detail="No Anthropic API key provided. Add your key via the ⚙ Settings panel in the app.",
            )
        resolved_key = api_key

    client = get_async_claude_client(resolved_key)

    t0 = time.perf_counter()
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        )
        elapsed = time.perf_counter() - t0
        raw_text = response.content[0].text.strip()
        parsed = _attach_response_metadata(
            _parse_json_block(raw_text),
            model,
            has_rag_context,
        )
        in_tok  = getattr(getattr(response, "usage", None), "input_tokens", 0)
        out_tok = getattr(getattr(response, "usage", None), "output_tokens", 0)
        if not isinstance(in_tok, (int, float)):
            in_tok = 0
        if not isinstance(out_tok, (int, float)):
            out_tok = 0
        cost    = compute_cost_usd(model, in_tok, out_tok)

        logger.info(
            "Agent %s completed in %.2fs | input=%d output=%d tokens | "
            "cost=$%.4f | model=%s | rag=%s",
            agent_name, elapsed, in_tok, out_tok, cost, model, has_rag_context,
        )

        return AgentResponse(
            agent=agent_name,
            model=model,
            result=parsed,
            timestamp=_utc_timestamp(),
            token_usage={"input_tokens": in_tok, "output_tokens": out_tok},
            cost_usd=cost,
            generation_time_seconds=round(elapsed, 3),
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
    """Convert raw text input into a structured format before sending to Claude."""
    cleaned    = " ".join(text.split())
    word_count = len(cleaned.split())

    if word_count > 5000:
        cleaned   = " ".join(cleaned.split()[:5000])
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
