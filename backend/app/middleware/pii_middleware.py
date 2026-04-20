"""
PII Detection Middleware
Implements Rule 8: Strip PII before LLM API calls

Implemented as a pure ASGI class middleware (not BaseHTTPMiddleware) so that
the request body can be buffered, inspected, and replayed safely without
hitting Starlette's "Unexpected message received: http.request" crash.

Root cause of the old crash:
  BaseHTTPMiddleware wraps the receive stream internally.  Re-assigning
  request._receive has no effect — Starlette ignores the patched attribute
  and the body ends up consumed with no way to restore it.

Fix:
  Own the entire ASGI receive coroutine.  Buffer all body chunks from the
  *real* receive, run PII detection, then hand the downstream app a synthetic
  receive callable that replays the (possibly redacted) body exactly once.
"""

import json
import logging

from app.services.pii_detector import pii_detector

logger = logging.getLogger(__name__)

# Endpoints that require PII detection
_PII_CHECK_PATHS = [
    "/api/evaluate",        # M1: Compliance checker
    "/api/generate/",       # M2: Document generator
    "/api/query/",          # M3: Query response
    "/api/regulatory/",     # M4: Regulatory intelligence
    "/api/v1/",             # Production safety endpoints
]


class PIIDetectionMiddleware:
    """
    Pure-ASGI middleware to detect and redact PII in requests.

    - Buffers the entire request body from the real ASGI receive stream.
    - Scans the body for PII.
    - Redacts PII before the request reaches the route handler.
    - Stores a redaction report in the ASGI scope (under scope["state"]) so
      downstream handlers can inspect it via request.state.
    - Adds X-PII-Detected / X-PII-Redacted-Count response headers.
    - Applies only to POST/PUT requests on the configured path prefixes.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Pass non-HTTP scopes (websocket, lifespan) straight through.
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "")
        path = scope.get("path", "")

        requires_pii_check = method in ("POST", "PUT") and any(
            path.startswith(p) for p in _PII_CHECK_PATHS
        )

        # ------------------------------------------------------------------ #
        # Initialise state bucket that Starlette exposes as request.state.    #
        # ------------------------------------------------------------------ #
        if "state" not in scope:
            scope["state"] = {}

        scope["state"]["pii_redacted"] = False
        scope["state"]["redaction_map"] = {}
        scope["state"]["pii_summary"] = {}

        if not requires_pii_check:
            # No PII work needed — pass the original receive through untouched.
            await self.app(scope, receive, send)
            return

        # ------------------------------------------------------------------ #
        # Buffer the entire body from the real ASGI receive stream.           #
        # This is the ONLY safe way to read-then-replay the body;             #
        # request._receive patching does NOT work with BaseHTTPMiddleware.    #
        # ------------------------------------------------------------------ #
        body_parts = []
        more_body = True
        while more_body:
            message = await receive()
            body_parts.append(message.get("body", b""))
            more_body = message.get("more_body", False)

        full_body = b"".join(body_parts)

        # ------------------------------------------------------------------ #
        # PII detection and optional redaction.                               #
        # ------------------------------------------------------------------ #
        final_body = full_body  # default: pass through as-is

        if full_body:
            try:
                body_str = full_body.decode("utf-8")
                body_json = json.loads(body_str)
                body_text = json.dumps(body_json)

                if pii_detector.has_pii(body_text):
                    pii_summary = pii_detector.get_pii_summary(body_text)

                    logger.warning(
                        f"PII detected in request to {path}",
                        extra={
                            "path": path,
                            "pii_types": list(pii_summary.keys()),
                            "pii_count": sum(pii_summary.values()),
                            "session_id": dict(scope.get("headers", [])).get(
                                b"x-session-id", b""
                            ).decode("utf-8", errors="ignore"),
                        },
                    )

                    # Redact PII — returns (redacted_text: str, report: dict)
                    redacted_text, redaction_report = pii_detector.detect_and_redact(body_text)

                    # Re-encode redacted JSON to bytes
                    redacted_json = json.loads(redacted_text)
                    final_body = json.dumps(redacted_json).encode("utf-8")

                    # Store redaction report in scope["state"] (→ request.state)
                    scope["state"]["pii_redacted"] = True
                    scope["state"]["redaction_map"] = redaction_report
                    scope["state"]["pii_summary"] = pii_summary

                    redaction_count = redaction_report.get("total_redactions", 0)
                    logger.info(
                        f"PII redacted: {redaction_count} instances",
                        extra={
                            "session_id": dict(scope.get("headers", [])).get(
                                b"x-session-id", b""
                            ).decode("utf-8", errors="ignore"),
                            "redaction_count": redaction_count,
                        },
                    )
                else:
                    scope["state"]["pii_redacted"] = False
                    scope["state"]["redaction_map"] = {}

            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.warning(f"Could not parse request body for PII detection: {e}")
                scope["state"]["pii_redacted"] = False
                scope["state"]["redaction_map"] = {}
                # final_body remains full_body — raw bytes pass through

        # ------------------------------------------------------------------ #
        # Synthetic receive callable that replays the (possibly redacted)     #
        # body exactly once, then signals end-of-stream on subsequent calls.  #
        # ------------------------------------------------------------------ #
        replayed = False

        async def receive_with_body():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": final_body, "more_body": False}
            # After the body has been delivered, block indefinitely or return
            # disconnect — this satisfies any client-disconnect polling.
            return {"type": "http.disconnect"}

        # ------------------------------------------------------------------ #
        # Intercept send so we can inject PII response headers.               #
        # ------------------------------------------------------------------ #
        async def send_with_pii_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                pii_redacted = scope["state"].get("pii_redacted", False)
                headers.append(
                    (b"x-pii-detected", str(pii_redacted).encode("utf-8"))
                )
                if pii_redacted:
                    count = scope["state"].get("redaction_map", {}).get(
                        "total_redactions", 0
                    )
                    headers.append(
                        (b"x-pii-redacted-count", str(count).encode("utf-8"))
                    )
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive_with_body, send_with_pii_headers)
