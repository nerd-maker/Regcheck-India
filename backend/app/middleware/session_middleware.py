"""
Session Tracking Middleware
Implements Rule 2: Require session ID for all API calls
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)


class SessionTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce session ID requirement for all API calls
    
    - Checks for X-Session-ID header
    - Validates session exists
    - Attaches session to request state
    - Returns session ID in response headers
    """
    
    # Paths under /api/ that are exempt from the session-ID requirement.
    # Agent routes use BYOK (x-anthropic-api-key) instead of sessions.
    SESSION_EXEMPT_PREFIXES = [
        "/api/v1/agents/",   # All agent endpoints (BYOK auth)
        "/api/models/",      # Model status — read-only probe
        "/api/kb/",          # Knowledge base stats
    ]

    async def dispatch(self, request: Request, call_next):
        # Skip session check for health/docs endpoints
        if request.url.path in ["/", "/health", "/ready", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)
        
        # Skip OPTIONS preflight requests — browsers don't send custom headers
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Skip exempt sub-paths (agent routes, model status, etc.)
        if any(request.url.path.startswith(p) for p in self.SESSION_EXEMPT_PREFIXES):
            return await call_next(request)
        
        # Require session ID for all other API endpoints
        if request.url.path.startswith("/api/"):
            session_id = request.headers.get("X-Session-ID")
            
            if not session_id:
                logger.warning(
                    f"Missing session ID for {request.method} {request.url.path}",
                    extra={"path": request.url.path, "method": request.method}
                )
                
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "Missing required header",
                        "detail": "X-Session-ID header is required for all API calls",
                        "hint": "Create a session first using POST /api/v1/sessions"
                    }
                )
            
            # Validate session exists (optional - can be expensive)
            # from app.services.session_manager import session_manager
            # session = session_manager.get_session(session_id)
            # if not session:
            #     return JSONResponse(
            #         status_code=404,
            #         content={"error": "Session not found", "session_id": session_id}
            #     )
            
            # Attach session ID to request state
            request.state.session_id = session_id
            
            logger.debug(
                f"Session attached: {session_id}",
                extra={"session_id": session_id, "path": request.url.path}
            )
        
        # Process request
        response = await call_next(request)
        
        # Add session ID to response headers
        if hasattr(request.state, "session_id"):
            response.headers["X-Session-ID"] = request.state.session_id
        
        return response
