"""
Request ID Middleware
Generates a unique X-Request-ID for each HTTP request.
Enables log correlation and distributed tracing.
"""

import uuid
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware that assigns a unique request ID to every incoming request.
    
    - If the client sends X-Request-ID, use it
    - Otherwise, generate a new UUID
    - Attach to request state and response headers
    - Log the request ID for tracing
    """
    
    async def dispatch(self, request: Request, call_next):
        # Use client-provided ID or generate a new one
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Attach to request state for downstream use
        request.state.request_id = request_id
        
        logger.info(
            f"{request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
            }
        )
        
        # Process request
        response = await call_next(request)
        
        # Add to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response
