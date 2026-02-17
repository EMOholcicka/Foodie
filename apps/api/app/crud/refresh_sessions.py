from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_session import RefreshSession


async def create_refresh_session(*, session: AsyncSession, user_id: uuid.UUID, current_jti: str) -> RefreshSession:
    rs = RefreshSession(user_id=user_id, current_jti=current_jti)
    session.add(rs)
    await session.flush()
    return rs


async def get_refresh_session_by_jti_for_update(*, session: AsyncSession, jti: str) -> RefreshSession | None:
    # Lock the row to enforce single-use rotation across concurrent refresh requests.
    stmt = select(RefreshSession).where(RefreshSession.current_jti == jti).with_for_update()
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def rotate_refresh_session(*, session: AsyncSession, refresh_session: RefreshSession, new_jti: str) -> RefreshSession:
    refresh_session.current_jti = new_jti
    await session.flush()
    return refresh_session
