from __future__ import annotations

import json
import logging
import re
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


def get_logger(name: str | None = None) -> logging.Logger:
    """Return a stdlib logger.

    Kept as a tiny compatibility shim for routes/modules that historically used
    `get_logger(__name__)`.
    """

    return logging.getLogger(name)


_request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    return _request_id_ctx.get()


_REQUEST_ID_ALLOWED_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def _normalize_request_id(value: str | None) -> str:
    """Validate incoming X-Request-ID header.

    - Only allow a conservative character set
    - Limit length
    - Fall back to a generated UUID if invalid
    """

    if value is None:
        return str(uuid.uuid4())

    candidate = value.strip()
    if not candidate or not _REQUEST_ID_ALLOWED_RE.fullmatch(candidate):
        return str(uuid.uuid4())

    return candidate


class RequestIdMiddleware(BaseHTTPMiddleware):
    header_name = "X-Request-ID"

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        request_id = _normalize_request_id(request.headers.get(self.header_name))
        token = _request_id_ctx.set(request_id)
        try:
            response = await call_next(request)
        except Exception:
            # Ensure the request_id context is available to exception handlers.
            # `BaseHTTPMiddleware` will re-raise into Starlette's exception stack,
            # so handlers can still produce a response.
            _request_id_ctx.reset(token)
            raise
        else:
            _request_id_ctx.reset(token)

        response.headers[self.header_name] = request_id
        return response


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }

        request_id = get_request_id()
        if request_id:
            payload["request_id"] = request_id

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False)


def setup_logging(*, level: str = "INFO") -> None:
    root = logging.getLogger()

    # Replace handlers to avoid duplicate logs in uvicorn reload.
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root.addHandler(handler)
    root.setLevel(level.upper())

    # Reduce noisy access logs; app logs should be used instead.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
