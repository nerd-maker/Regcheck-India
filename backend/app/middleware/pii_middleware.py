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
    - Stores redaction map in request state
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
            # Read request body
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
                                "session_id": request.headers.get("X-Session-ID")
                            }
                        )
                        
                        # Redact PII
                        redacted_text, redaction_map = pii_detector.redact_pii(body_text)
                        
                        # Parse redacted JSON
                        redacted_json = json.loads(redacted_text)
                        
                        # Store redaction map in request state
                        request.state.pii_redacted = True
                        request.state.redaction_map = redaction_map
                        request.state.pii_summary = pii_summary
                        
                        # Replace request body with redacted version
                        redacted_body = json.dumps(redacted_json).encode("utf-8")
                        
                        # Create new request with redacted body
                        async def receive():
                            return {"type": "http.request", "body": redacted_body}
                        
                        request._receive = receive
                        
                        logger.info(
                            f"PII redacted: {len(redaction_map)} instances",
                            extra={
                                "session_id": request.headers.get("X-Session-ID"),
                                "redaction_count": len(redaction_map)
                            }
                        )
                    else:
                        request.state.pii_redacted = False
                        request.state.redaction_map = []
                
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    logger.warning(f"Could not parse request body for PII detection: {e}")
                    request.state.pii_redacted = False
                    request.state.redaction_map = []
        
        # Process request
        response = await call_next(request)
        
        # Add PII detection header to response
        if hasattr(request.state, "pii_redacted"):
            response.headers["X-PII-Detected"] = str(request.state.pii_redacted)
            if request.state.pii_redacted:
                response.headers["X-PII-Redacted-Count"] = str(len(request.state.redaction_map))
        
        return response
