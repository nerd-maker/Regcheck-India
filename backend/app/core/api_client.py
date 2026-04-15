"""
LLM API Client Factory — Anthropic Claude

Provides convenience wrappers around the centralized claude_client module.
Kept for backwards compatibility with any code importing from app.core.api_client.

Usage:
    from app.core.api_client import get_llm_client
    client = get_llm_client()
"""

import time
import logging
from functools import wraps

import anthropic

from app.services.claude_client import get_claude_client

logger = logging.getLogger(__name__)

# Default timeout in seconds for LLM API calls
DEFAULT_TIMEOUT = 60.0

# Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0  # seconds
RETRYABLE_ERRORS = (anthropic.APIConnectionError, anthropic.RateLimitError)


def get_llm_client(timeout: float = DEFAULT_TIMEOUT) -> anthropic.Anthropic:
    """
    Return a pre-configured Anthropic client.
    
    Args:
        timeout: Request timeout in seconds (default 60s)
    
    Returns:
        Configured Anthropic client instance
    """
    return get_claude_client()


def retry_on_failure(max_retries: int = MAX_RETRIES, backoff_base: float = RETRY_BACKOFF_BASE):
    """
    Decorator that retries a function on transient API failures.
    
    Uses exponential backoff: 2s, 4s, 8s.
    Only retries on connection errors and rate limits, NOT on auth or bad request errors.
    
    Usage:
        @retry_on_failure()
        def call_llm(client, prompt):
            return client.messages.create(...)
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except RETRYABLE_ERRORS as e:
                    last_exception = e
                    if attempt < max_retries:
                        wait_time = backoff_base ** (attempt + 1)
                        logger.warning(
                            f"API call failed (attempt {attempt + 1}/{max_retries + 1}), "
                            f"retrying in {wait_time}s: {e}",
                            extra={
                                "attempt": attempt + 1,
                                "max_retries": max_retries + 1,
                                "wait_seconds": wait_time,
                                "error_type": type(e).__name__,
                            }
                        )
                        time.sleep(wait_time)
                    else:
                        logger.error(
                            f"API call failed after {max_retries + 1} attempts: {e}",
                            extra={"error_type": type(e).__name__}
                        )
                        raise
                except anthropic.APIError as e:
                    # Non-retryable API errors (auth, bad request, etc.)
                    logger.error(f"Non-retryable API error: {e}")
                    raise
            
            raise last_exception  # Should not reach here, but safety net
        return wrapper
    return decorator
