from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import text

import app.db.session as db_session
from app.core.logging import get_logger

router = APIRouter(tags=["health"])
logger = get_logger(__name__)

_DB_READY_TIMEOUT_S = 2.0


@router.get("/healthz")
async def healthz(_bad: int | None = Query(default=None)) -> dict[str, str]:
    """Liveness probe.

    Must stay lightweight and must not depend on external services (e.g. DB).
    """

    return {"status": "ok"}


@router.get("/readyz")
async def readyz(response: Response) -> dict[str, str]:
    """Readiness probe.

    Returns 200 only if the app is able to talk to the DB.

    Notes:
    - Re-raise only cancellation (so shutdowns behave correctly).
    - Treat timeouts and all other failures as 503 (not ready).
    - Use a short timeout so readiness doesn't hang under DB slowness.
    """

    engine = db_session.get_engine()

    try:
        async def _check_db() -> None:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))

        await asyncio.wait_for(_check_db(), timeout=_DB_READY_TIMEOUT_S)

    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("readiness check failed")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready"}

    return {"status": "ready"}
