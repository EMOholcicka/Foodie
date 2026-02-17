from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.weight_entries import (
    create_weight_entry,
    delete_weight_entry_for_user,
    list_weight_entries,
    update_weight_entry_for_user,
)
from app.db.session import get_db_session
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.weights import WeightEntryCreate, WeightEntryListOut, WeightEntryOut, WeightEntryUpdate

router = APIRouter(prefix="/weights", tags=["weights"])


def _normalize_query_dt(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _to_out(entry) -> dict:
    dt = entry.datetime_utc
    dt_str = dt.isoformat().replace("+00:00", "Z")

    return WeightEntryOut(
        id=str(entry.id),
        datetime_=dt_str,
        weight_kg=float(entry.weight_kg),
        note=entry.note,
    ).model_dump(by_alias=True)


@router.post("", response_model=None, status_code=status.HTTP_201_CREATED)
async def create_weight(
    payload: WeightEntryCreate,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> dict:
    entry = await create_weight_entry(
        session=session,
        user_id=user.id,
        datetime_utc=payload.datetime_,
        weight_kg=payload.weight_kg,
        note=payload.note,
    )
    await session.commit()
    return _to_out(entry)


@router.get("", response_model=None)
async def list_weights(
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> dict:
    from_dt = _normalize_query_dt(from_)
    to_dt = _normalize_query_dt(to)
    if from_dt is not None and to_dt is not None and from_dt > to_dt:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="'from' must be <= 'to'")

    items = await list_weight_entries(
        session=session,
        user_id=user.id,
        from_dt=from_dt,
        to_dt=to_dt,
    )
    return {"items": [_to_out(i) for i in items]}


@router.patch("/{entry_id}", response_model=WeightEntryOut)
async def patch_weight(
    entry_id: uuid.UUID,
    payload: WeightEntryUpdate,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> WeightEntryOut:
    entry = await update_weight_entry_for_user(
        session=session,
        user_id=user.id,
        entry_id=entry_id,
        datetime_utc=payload.datetime_,
        weight_kg=payload.weight_kg,
        note=payload.note,
        note_is_set=("note" in payload.model_fields_set),
    )
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weight entry not found")
    await session.commit()
    return _to_out(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_weight(
    entry_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> None:
    deleted = await delete_weight_entry_for_user(session=session, user_id=user.id, entry_id=entry_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weight entry not found")
    await session.commit()
    return None
