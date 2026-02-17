from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Keep this CSP aligned with nginx (infra/nginx/nginx.prod.conf).
# It should be conservative enough to not break basic docs UIs (e.g. Swagger/ReDoc)
# if they are enabled, while still being safe for API-only responses.
_API_SAFE_CSP = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add defensive security headers.

    Prefer setting these at the edge (nginx), but keep an app-level fallback
    for environments where the API is exposed directly.

    Headers are only added if not already present, so nginx can override.
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        response.headers.setdefault("Content-Security-Policy", _API_SAFE_CSP)

        return response
