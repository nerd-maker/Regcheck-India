"""
Robust JSON Parser with Retry Logic
Implements Rule 7: Fallback behavior for unparseable LLM responses
"""

import json
import logging
from typing import Any, Dict, Optional

from app.services.claude_client import call_claude, MODEL_HAIKU

logger = logging.getLogger(__name__)


class JSONParseError(Exception):
    """Custom exception for JSON parsing failures"""
    pass


class RobustJSONParser:
    """
    JSON parser with automatic retry and repair logic
    
    If initial parse fails:
    1. Retry once with repair prompt
    2. If still fails, route to human review
    3. Never silently swallow parse errors
    """
    
    @staticmethod
    async def parse_with_retry(
        response_text: str,
        session_id: str,
        module: str,
        client: Any = None,
        max_retries: int = 1
    ) -> Dict[str, Any]:
        """
        Parse JSON with automatic retry on failure
        
        Args:
            response_text: Raw LLM response text
            session_id: Session ID for audit trail
            module: Module name (M1, M2, M3, M4)
            client: Unused (kept for API compatibility)
            max_retries: Maximum retry attempts (default: 1)
            
        Returns:
            Parsed JSON dict
            
        Raises:
            JSONParseError: If parsing fails after retries
        """
        # First attempt
        try:
            parsed = json.loads(response_text)
            logger.info(f"JSON parsed successfully on first attempt")
            return parsed
            
        except json.JSONDecodeError as e:
            logger.warning(
                f"JSON parse failed: {str(e)}",
                extra={
                    "session_id": session_id,
                    "module": module,
                    "error": str(e),
                    "position": e.pos
                }
            )
            
            # Retry with repair prompt
            if max_retries > 0:
                return await RobustJSONParser._retry_with_repair(
                    response_text=response_text,
                    error=e,
                    session_id=session_id,
                    module=module,
                )
            else:
                raise JSONParseError(f"JSON parsing failed: {str(e)}")
    
    @staticmethod
    async def _retry_with_repair(
        response_text: str,
        error: json.JSONDecodeError,
        session_id: str,
        module: str,
    ) -> Dict[str, Any]:
        """Retry parsing with repair prompt"""
        
        repair_prompt = f"""The following text should be valid JSON but failed to parse with error:
Error: {str(error)}
Position: {error.pos}

Text:
{response_text}

Please return ONLY the corrected JSON, with no additional text, explanations, or markdown formatting.
Ensure all strings are properly quoted, all brackets are balanced, and there are no trailing commas."""

        logger.info(f"Attempting JSON repair via LLM")
        
        try:
            result = call_claude(
                prompt=repair_prompt,
                model=MODEL_HAIKU,
                max_tokens=len(response_text) + 1000,
                temperature=0.0,
            )
            
            repaired_text = result["content"].strip()
            
            # Remove markdown code blocks if present
            if repaired_text.startswith("```"):
                lines = repaired_text.split("\n")
                repaired_text = "\n".join(lines[1:-1])
            
            # Try parsing repaired JSON
            parsed = json.loads(repaired_text)
            
            logger.info(
                f"JSON successfully repaired and parsed",
                extra={"session_id": session_id}
            )
            
            return parsed
            
        except (json.JSONDecodeError, Exception) as retry_error:
            logger.error(
                f"JSON repair failed: {str(retry_error)}",
                extra={
                    "session_id": session_id,
                    "module": module,
                    "original_error": str(error),
                    "retry_error": str(retry_error)
                }
            )
            
            # Route to human review (will be handled by caller)
            raise JSONParseError(
                f"JSON parsing failed after retry. Original error: {str(error)}, "
                f"Retry error: {str(retry_error)}"
            )
    
    @staticmethod
    def parse_sync(response_text: str) -> Dict[str, Any]:
        """Synchronous parse without retry (for simple cases)"""
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse failed: {str(e)}")
            raise JSONParseError(f"JSON parsing failed: {str(e)}")


# Convenience function
async def parse_llm_json(
    response_text: str,
    session_id: str,
    module: str,
    client: Any = None
) -> Dict[str, Any]:
    """
    Parse LLM JSON response with automatic retry
    
    Usage:
        result = await parse_llm_json(
            response_content,
            session_id,
            "M2"
        )
    """
    return await RobustJSONParser.parse_with_retry(
        response_text=response_text,
        session_id=session_id,
        module=module,
        client=client
    )
