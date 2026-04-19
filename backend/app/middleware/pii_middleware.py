"""
PII Detection Middleware
Implements Rule 8: Strip PII before LLM API calls
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import json
import logging

from app.services.pii_detector import pii_detector

logger = logging.getLogger(__name__)


class PIIDetectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to detect and redact PII in requests

    - Scans request body for PII
    - Redacts PII before processing
    - Stores redaction report in request state
    - Logs PII detection events

    Applied to M1 and M2 endpoints only (document processing)
    """

    # Endpoints that require PII detection
    PII_CHECK_PATHS = [
        "/api/evaluate",         # M1: Compliance checker
        "/api/generate/",        # M2: Document generator
        "/api/query/",           # M3: Query response
        "/api/regulatory/",      # M4: Regulatory intelligence
        "/api/v1/",              # Production safety endpoints
    ]

    async def dispatch(self, request: Request, call_next):
        # Check if this endpoint requires PII detection
        requires_pii_check = any(
            request.url.path.startswith(path)
            for path in self.PII_CHECK_PATHS
        )

        if requires_pii_check and request.method in ["POST", "PUT"]:
            # Read request body — this exhausts the ASGI receive stream.
            # We MUST restore it in every code path before calling call_next().
            body = await request.body()

            if body:
                try:
                    # Parse JSON body
                    body_str = body.decode("utf-8")
                    body_json = json.loads(body_str)

                    # Convert to string for PII detection
                    body_text = json.dumps(body_json)

                    # Detect PII
                    if pii_detector.has_pii(body_text):
                        pii_summary = pii_detector.get_pii_summary(body_text)

                        logger.warning(
                            f"PII detected in request to {request.url.path}",
                            extra={
                                "path": request.url.path,
                                "pii_types": list(pii_summary.keys()),
                                "pii_count": sum(pii_summary.values()),
                                "session_id": request.headers.get("X-Session-ID"),
                            },
                        )

                        # Redact PII — returns (redacted_text: str, report: dict)
                        redacted_text, redaction_report = pii_detector.detect_and_redact(body_text)

                        # Re-encode redacted JSON to bytes
                        redacted_json = json.loads(redacted_text)
                        redacted_body = json.dumps(redacted_json).encode("utf-8")

                        # Store redaction report in request state
                        request.state.pii_redacted = True
                        request.state.redaction_map = redaction_report
                        request.state.pii_summary = pii_summary

                        # Restore stream with REDACTED body so the route handler
                        # can read it. more_body=False stops Starlette reading a
                        # second chunk (which raises "Unexpected message received").
                        async def receive_redacted():
                            return {"type": "http.request", "body": redacted_body, "more_body": False}

                        request._receive = receive_redacted

                        redaction_count = redaction_report.get("total_redactions", 0)
                        logger.info(
                            f"PII redacted: {redaction_count} instances",
                            extra={
                                "session_id": request.headers.get("X-Session-ID"),
                                "redaction_count": redaction_count,
                            },
                        )

                    else:
                        # No PII — restore original body so the route handler
                        # can still read it (stream was consumed above).
                        request.state.pii_redacted = False
                        request.state.redaction_map = {}

                        async def receive_clean():
                            return {"type": "http.request", "body": body, "more_body": False}

                        request._receive = receive_clean

                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    logger.warning(f"Could not parse request body for PII detection: {e}")
                    request.state.pii_redacted = False
                    request.state.redaction_map = {}

                    # Restore original body even on parse failure so the route
                    # handler still receives the raw bytes it needs.
                    async def receive_passthrough():
                        return {"type": "http.request", "body": body, "more_body": False}

                    request._receive = receive_passthrough

        # Process request
        response = await call_next(request)

        # Add PII detection header to response
        if hasattr(request.state, "pii_redacted"):
            response.headers["X-PII-Detected"] = str(request.state.pii_redacted)
            if request.state.pii_redacted:
                response.headers["X-PII-Redacted-Count"] = str(
                    request.state.redaction_map.get("total_redactions", 0)
                )

        return response
