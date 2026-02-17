from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.settings import get_settings


def create_engine(*, database_url: str | None = None) -> AsyncEngine:
    """Create the SQLAlchemy async engine.

    Notes:
        - Uses `settings.DATABASE_URL` by default.
        - Leaves DB initialization/migrations to Alembic.
    """

    settings = get_settings()
    url = database_url or settings.database_url

    # sqlalchemy+psycopg is async-capable when using psycopg3.
    return create_async_engine(url, pool_pre_ping=True)


_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_engine()
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(
            bind=get_engine(),
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )
    return _sessionmaker


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields an async session.

    Ensures rollback on exceptions so the connection is returned to the pool
    in a clean state.
    """

    session_maker = get_sessionmaker()
    async with session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
