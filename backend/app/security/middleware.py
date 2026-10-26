"""
VitalStream Security — HTTP Security Headers & Rate Limiting Middleware.
Complies with OWASP Secure Headers & HIPAA § 164.312 Technical Safeguards.
"""

import time
import uuid
import logging
from typing import Dict, Tuple
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("vitalstream.security")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injects enterprise-grade HTTP security headers on all responses:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: SAMEORIGIN
    - X-XSS-Protection: 1; mode=block
    - Strict-Transport-Security (HSTS)
    - Content-Security-Policy (CSP)
    - Referrer-Policy
    - Permissions-Policy
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # 1. Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # 2. Prevent clickjacking
        response.headers["X-Frame-Options"] = "SAMEORIGIN"

        # 3. Legacy cross-site scripting filter
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # 4. Strict Transport Security (HSTS)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # 5. Referrer policy for privacy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 6. Feature / Permissions policy
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"

        # 7. Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' ws: wss: http: https:; "
            "frame-ancestors 'self';"
        )

        return response


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Sliding window in-memory rate limiter to protect hospital API against DoS / brute force.
    - General read endpoints: 180 req/min
    - Clinical write endpoints (orders, beds, ack): 60 req/min per client IP
    """

    def __init__(self, app, read_limit: int = 180, write_limit: int = 60, window_secs: int = 60):
        super().__init__(app)
        self.read_limit = read_limit
        self.write_limit = write_limit
        self.window_secs = window_secs
        # Key: (ip, is_write) -> list of timestamp floats
        self._requests: Dict[Tuple[str, bool], list[float]] = {}

    async def dispatch(self, request: Request, call_next):
        # Exclude static assets and websocket upgrades from HTTP rate limiter
        if request.url.path.startswith("/ws") or request.scope.get("type") == "websocket":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        is_write = request.method in ("POST", "PUT", "PATCH", "DELETE")
        limit = self.write_limit if is_write else self.read_limit

        now = time.time()
        key = (client_ip, is_write)

        # Clean old timestamps outside sliding window
        timestamps = self._requests.get(key, [])
        cutoff = now - self.window_secs
        timestamps = [ts for ts in timestamps if ts > cutoff]

        if len(timestamps) >= limit:
            logger.warning(f"Rate limit exceeded for {client_ip} on {request.method} {request.url.path}")
            retry_after = int(self.window_secs - (now - timestamps[0])) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": f"Rate limit exceeded ({limit} requests per minute). Please throttle operations.",
                    "retry_after_seconds": retry_after
                },
                headers={"Retry-After": str(retry_after)}
            )

        timestamps.append(now)
        self._requests[key] = timestamps

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - len(timestamps)))
        return response


async def secure_exception_handler(request: Request, exc: Exception) -> Response:
    """
    Sanitized global exception handler:
    Logs the full traceback securely on server, but returns an opaque correlation error_id
    to prevent internal stack traces or connection string leaks to the public client.
    """
    error_id = str(uuid.uuid4())[:8]
    logger.error(f"[Error-ID: {error_id}] Unhandled exception during {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing the clinical request.",
            "error_id": error_id,
            "support_contact": "clinical-engineering@vitalstream.local"
        }
    )
