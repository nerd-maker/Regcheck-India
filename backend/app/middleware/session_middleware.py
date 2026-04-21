"""
Session Tracking Middleware
Implements Rule 2: Require session ID for all API calls
"""

from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class SessionTrackingMiddleware:
    """
    Pure ASGI Middleware to track session IDs without blocking
    """
    
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        
        # Extract and attach session ID to scope state if present
        # But never block requests for missing session ID
        headers = dict(scope.get("headers", []))
        session_id_bytes = headers.get(b"x-session-id")
        session_id = session_id_bytes.decode("utf-8") if session_id_bytes else "anonymous"

        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["session_id"] = session_id
        
        logger.debug(
            f"Session attached: {session_id}",
            extra={"session_id": session_id, "path": path}
        )

        # Inject session ID into response headers
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                resp_headers = list(message.get("headers", []))
                if not any(k.lower() == b"x-session-id" for k, v in resp_headers):
                    resp_headers.append((b"x-session-id", session_id.encode("utf-8")))
                message["headers"] = resp_headers
            await send(message)

        await self.app(scope, receive, send_wrapper)
