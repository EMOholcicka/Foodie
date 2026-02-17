from __future__ import annotations

import os
from pathlib import Path

from alembic import command
from alembic.config import Config


def _truthy_env(name: str) -> bool:
    return (os.getenv(name) or "").strip().lower() in {"1", "true", "yes", "on"}


def _resolve_alembic_ini_path() -> str:
    """Resolve alembic.ini path robustly for both local runs and containers."""

    explicit = (os.getenv("ALEMBIC_INI") or "").strip()
    if explicit:
        explicit_path = Path(explicit)
        if not explicit_path.exists():
            raise RuntimeError(
                f"ALEMBIC_INI is set to '{explicit}', but that file does not exist"
            )
        return explicit

    # Container default: most Dockerfiles copy the API into /app.
    container_default = Path("/app/alembic.ini")
    if container_default.exists():
        return str(container_default)

    # Local/repo runs: this module lives under apps/api/app/... so walk up to apps/api.
    api_root = Path(__file__).resolve().parents[3]
    local_default = api_root / "alembic.ini"
    return str(local_default)


def run_dev_migrations() -> None:
    """Run Alembic migrations automatically in dev (explicit opt-in).

    Guardrails:
    - Requires *both* ENV=dev and AUTO_MIGRATE=1 (or true/yes/on)
    - Requires DATABASE_URL

    Note: runs in-process at API startup.
    """

    env = (os.getenv("ENV") or "").lower()
    if env != "dev":
        return

    if not _truthy_env("AUTO_MIGRATE"):
        return

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        # Settings enforces this too, but keep error message direct.
        raise RuntimeError("DATABASE_URL is required to run dev migrations")

    cfg = Config(_resolve_alembic_ini_path())
    # env.py reads DATABASE_URL from environment, but set it explicitly as well.
    cfg.set_main_option("sqlalchemy.url", database_url)

    command.upgrade(cfg, "head")
