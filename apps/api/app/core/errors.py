from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import get_request_id

logger = logging.getLogger(__name__)


def _request_id() -> str | None:
    return get_request_id()


def _safe_json_detail(detail: Any) -> str | dict[str, Any] | list[Any]:
    """Normalize exception detail to a safe JSON type.

    FastAPI's `HTTPException.detail` is `Any`; ensure we only return JSON-safe
    structures and fall back to `str(detail)` for unexpected types.
    """

    if isinstance(detail, (str, dict, list)):
        return detail

    return str(detail)


def _safe_details(details: Any) -> Any:
    """Ensure error details are JSON serializable and stable.

    In Pydantic v2, `RequestValidationError.errors()` may include non-serializable
    values (e.g. `ValueError(...)` under `ctx.error`). We run the structure
    through FastAPI's `jsonable_encoder` to guarantee JSON-safe output.
    """

    return jsonable_encoder(details)


def _json_error(*, status_code: int, code: str, message: str, details: Any | None = None) -> JSONResponse:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        },
        "request_id": _request_id(),
    }
    if details is not None:
        payload["error"]["details"] = _safe_details(details)

    res = JSONResponse(status_code=status_code, content=payload)

    # Ensure the request id is also returned as a header, even on exceptions.
    # Middleware may not get a chance to attach headers when an error bubbles.
    rid = _request_id()
    if rid:
        res.headers["X-Request-ID"] = rid

    return res


async def request_validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Keep details similar to FastAPI default: list of error objects.
    return _json_error(
        status_code=422,
        code="request_validation_error",
        message="Request validation failed",
        details=exc.errors(),
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    # Avoid leaking sensitive exception details on 5xx.
    details: Any | None = None
    if 400 <= exc.status_code < 500:
        details = _safe_json_detail(exc.detail)

    return _json_error(
        status_code=exc.status_code,
        code="http_exception",
        message="HTTP error",
        details=details,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Log full exception server-side with request_id injected via logging context.
    logger.exception("Unhandled exception")

    # Starlette's TestClient (by default) re-raises server exceptions unless we
    # explicitly handle them. By returning a response here, we ensure clients see
    # our standardized 500 shape instead of an exception bubble.
    return _json_error(
        status_code=500,
        code="internal_server_error",
        message="Internal server error",
    )
