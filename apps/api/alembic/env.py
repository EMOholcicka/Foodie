from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.models.base import Base
from app.models.day import Day  # noqa: F401
from app.models.food import Food  # noqa: F401
from app.models.meal_entry import MealEntry  # noqa: F401
from app.models.refresh_session import RefreshSession  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.weight_entry import WeightEntry  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is required to run Alembic migrations")
    return url


def get_target_metadata() -> Base.metadata.__class__:
    return Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=get_database_url(),
        target_metadata=get_target_metadata(),
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=get_target_metadata(),
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_database_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def _run_async(coro) -> None:
    """Run an async coroutine from alembic env.

    Alembic executes this file in-process.

    This MUST be blocking: running migrations in the background (e.g. via
    loop.create_task()) risks starting the API before schema is up-to-date.

    If a loop is already running, we fail fast with a clear message instructing
    the caller to run Alembic synchronously (e.g. as a pre-start step) instead.
    """

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(coro)
        return

    raise RuntimeError(
        "Alembic migrations cannot run under an already running event loop. "
        "Run Alembic synchronously before starting the server (e.g. `alembic upgrade head`), "
        "or disable AUTO_MIGRATE for in-process startup."
    )


if context.is_offline_mode():
    run_migrations_offline()
else:
    _run_async(run_migrations_online())
