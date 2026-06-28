"""
Request ID + Timing Middleware
Generates a unique X-Request-ID for every HTTP request and logs total
request latency. Both values are returned in response headers.
"""

import time
import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attaches X-Request-ID and X-Response-Time to every request/response.

    - Reuses client-supplied X-Request-ID when present (useful for tracing
      from the frontend or API gateway).
    - Logs: method, path, status, latency in ms, and request_id on every line.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
        request.state.request_id = request_id

        t0 = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - t0) * 1000)

        logger.info(
            "[%s] %s %s → %s (%dms)",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )

        response.headers["X-Request-ID"]    = request_id
        response.headers["X-Response-Time"] = f"{elapsed_ms}ms"
        return response
