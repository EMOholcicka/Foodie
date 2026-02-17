from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.weight_entry import WeightEntry


async def create_weight_entry(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    datetime_utc: datetime,
    weight_kg: float,
    note: str | None,
) -> WeightEntry:
    entry = WeightEntry(
        user_id=user_id,
        datetime_utc=datetime_utc,
        weight_kg=weight_kg,
        note=note,
    )
    session.add(entry)
    await session.flush()
    await session.refresh(entry)
    return entry


async def list_weight_entries(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    from_dt: datetime | None,
    to_dt: datetime | None,
) -> list[WeightEntry]:
    stmt = select(WeightEntry).where(WeightEntry.user_id == user_id)
    if from_dt is not None:
        stmt = stmt.where(WeightEntry.datetime_utc >= from_dt)
    if to_dt is not None:
        stmt = stmt.where(WeightEntry.datetime_utc <= to_dt)

    stmt = stmt.order_by(WeightEntry.datetime_utc.asc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_weight_entry_by_id_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
) -> WeightEntry | None:
    stmt = select(WeightEntry).where(
        WeightEntry.id == entry_id,
        WeightEntry.user_id == user_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def update_weight_entry_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
    datetime_utc: datetime | None,
    weight_kg: float | None,
    note: str | None,
    note_is_set: bool,
) -> WeightEntry | None:
    values: dict = {}
    if datetime_utc is not None:
        values["datetime_utc"] = datetime_utc
    if weight_kg is not None:
        values["weight_kg"] = weight_kg

    # PATCH semantics: distinguish "omitted" vs explicit null.
    # - omitted: no change
    # - null: clear note
    # - str: set note
    if note_is_set:
        values["note"] = note

    # Ensure updated_at changes on PATCH (explicit set; avoid relying on DB triggers).
    # Only bump updated_at when there is at least one actual field change.
    if values:
        values["updated_at"] = datetime.now(tz=None)

    if not values:
        return await get_weight_entry_by_id_for_user(session=session, user_id=user_id, entry_id=entry_id)

    stmt = (
        update(WeightEntry)
        .where(WeightEntry.id == entry_id, WeightEntry.user_id == user_id)
        .values(**values)
        .returning(WeightEntry)
    )
    result = await session.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        return None
    await session.flush()
    return entry


async def delete_weight_entry_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
) -> bool:
    stmt = delete(WeightEntry).where(WeightEntry.id == entry_id, WeightEntry.user_id == user_id)
    result = await session.execute(stmt)
    return bool(result.rowcount)
