"""Gunicorn configuration for running FastAPI with Uvicorn workers.

This module is loaded by gunicorn via: `gunicorn -c app.core.gunicorn_conf app.main:app`.

All knobs are configurable via environment variables.

Defaults here are intentionally conservative for ASGI workloads (I/O-bound) and for
small production deployments.
"""

from __future__ import annotations

import logging
import multiprocessing
import os

logger = logging.getLogger(__name__)


def _get_int(name: str, default: int) -> int:
    """Read an integer env var.

    Safe production behavior: on invalid values, keep the default but emit a warning
    so misconfiguration is visible in logs.
    """

    raw = os.getenv(name)
    if raw is None or raw == "":
        return default

    try:
        return int(raw)
    except (TypeError, ValueError):
        logger.warning("Invalid int for %s=%r; using default=%s", name, raw, default)
        return default


def _default_web_concurrency() -> int:
    """Conservative ASGI-oriented default.

    For async workers, excessive process counts can increase memory/CPU overhead with
    little throughput gain. Default to 2 workers, scaled gently with CPU.

    Formula: min(4, max(2, CPU))
    """

    cpu = multiprocessing.cpu_count() or 1
    return min(4, max(2, cpu))


# Bind on the same interface/port as the current uvicorn CMD.
bind = os.getenv("BIND", "0.0.0.0:8000")

# ASGI worker.
worker_class = "uvicorn.workers.UvicornWorker"

# Worker count.
workers = _get_int("WEB_CONCURRENCY", _default_web_concurrency())

# Timeouts.
timeout = _get_int("GUNICORN_TIMEOUT", 60)
graceful_timeout = _get_int("GUNICORN_GRACEFUL_TIMEOUT", 30)
keepalive = _get_int("GUNICORN_KEEPALIVE", 5)

# Logging: forward everything to stdout/stderr (12-factor friendly).
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

# Preload can reduce memory usage but can also cause issues with some async init.
# Keep default off unless explicitly enabled.
preload_app = os.getenv("GUNICORN_PRELOAD", "false").lower() in {"1", "true", "yes"}
