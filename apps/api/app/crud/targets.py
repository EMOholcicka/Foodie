from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_target import UserTarget


async def get_active_user_target(*, session: AsyncSession, user_id: uuid.UUID, at_date: date | None = None) -> UserTarget | None:
    """Return the single effective target for a user.

    Deterministic rules:
    - If `at_date` is provided: pick the latest dated target with effective_date <= at_date.
      If none exists, fall back to the single NULL effective_date target (if present).
    - If `at_date` is not provided: prefer the single NULL effective_date target.
      If none exists, fall back to the latest dated target.

    Ordering is always explicit and limited to 1 row.
    """

    if at_date is None:
        stmt = (
            select(UserTarget)
            .where(UserTarget.user_id == user_id)
            .order_by(
                # Prefer NULL effective_date (active/default). Use CASE for dialect-safe
                # ordering rather than relying on boolean expression ordering.
                case((UserTarget.effective_date.is_(None), 0), else_=1).asc(),
                # Then prefer latest dated target
                UserTarget.effective_date.desc().nulls_last(),
                # Tie-breaker for determinism
                UserTarget.created_at.desc(),
                UserTarget.id.desc(),
            )
            .limit(1)
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    # at_date provided -> latest dated <= at_date, else fallback to NULL
    stmt = (
        select(UserTarget)
        .where(
            UserTarget.user_id == user_id,
            (
                (UserTarget.effective_date.is_not(None) & (UserTarget.effective_date <= at_date))
                | UserTarget.effective_date.is_(None)
            ),
        )
        .order_by(
            # Prefer dated matches over NULL fallback. Use CASE for dialect-safe ordering.
            case(
                (
                    UserTarget.effective_date.is_not(None)
                    & (UserTarget.effective_date <= at_date),
                    0,
                ),
                else_=1,
            ).asc(),
            UserTarget.effective_date.desc().nulls_last(),
            UserTarget.created_at.desc(),
            UserTarget.id.desc(),
        )
        .limit(1)
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def upsert_user_target(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    kcal_target: int,
    protein_g: Decimal,
    carbs_g: Decimal,
    fat_g: Decimal,
    effective_date: date | None,
) -> UserTarget:
    if effective_date is None:
        stmt = select(UserTarget).where(UserTarget.user_id == user_id, UserTarget.effective_date.is_(None))
    else:
        stmt = select(UserTarget).where(UserTarget.user_id == user_id, UserTarget.effective_date == effective_date)

    res = await session.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing is None:
        target = UserTarget(
            user_id=user_id,
            effective_date=effective_date,
            kcal_target=kcal_target,
            protein_g=protein_g,
            carbs_g=carbs_g,
            fat_g=fat_g,
        )
        session.add(target)
        await session.flush()
        await session.refresh(target)
        return target

    existing.kcal_target = kcal_target
    existing.protein_g = protein_g
    existing.carbs_g = carbs_g
    existing.fat_g = fat_g
    await session.flush()
    await session.refresh(existing)
    return existing
