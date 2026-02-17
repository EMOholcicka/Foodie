from __future__ import annotations

import uuid

from sqlalchemy import and_, delete, exists, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.day import Day
from app.models.food import Food
from app.models.meal_entry import MealEntry
from app.models.user_food_favorite import UserFoodFavorite


async def create_food_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    name: str,
    brand: str | None,
    kcal_100g: float,
    protein_100g: float,
    carbs_100g: float,
    fat_100g: float,
) -> Food:
    food = Food(
        user_id=user_id,
        name=name.strip(),
        brand=(brand.strip() if brand else None),
        kcal_100g=kcal_100g,
        protein_100g=protein_100g,
        carbs_100g=carbs_100g,
        fat_100g=fat_100g,
    )
    session.add(food)
    await session.flush()
    await session.refresh(food)
    return food


async def list_foods_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    query: str | None,
    limit: int = 20,
) -> list[Food]:
    stmt = select(Food).where(or_(Food.user_id.is_(None), Food.user_id == user_id))

    if query:
        q = f"%{query.strip().lower()}%"
        stmt = stmt.where(
            or_(
                Food.name.ilike(q),
                Food.brand.ilike(q),
            )
        )

    # Prefer user foods first, then global, then name.
    stmt = stmt.order_by(Food.user_id.is_(None).asc(), Food.name.asc())

    stmt = stmt.limit(limit)
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def set_favorite(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    food_id: uuid.UUID,
    is_favorite: bool,
) -> None:
    if is_favorite:
        # Idempotent insert.
        session.add(UserFoodFavorite(user_id=user_id, food_id=food_id))
        return

    stmt = delete(UserFoodFavorite).where(
        UserFoodFavorite.user_id == user_id,
        UserFoodFavorite.food_id == food_id,
    )
    await session.execute(stmt)


async def list_favorites_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 50,
) -> list[Food]:
    stmt = (
        select(Food)
        .join(UserFoodFavorite, UserFoodFavorite.food_id == Food.id)
        .where(UserFoodFavorite.user_id == user_id)
        .order_by(UserFoodFavorite.created_at.desc())
        .limit(limit)
    )
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def list_recent_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 20,
) -> list[Food]:
    """Most recently used foods for a user (deduped, ordered by last use).

    CRITICAL: Must be scoped to the current user's `MealEntry` rows to avoid
    cross-user leakage.

    Postgres-friendly single-query approach:
    - compute max(meal_entries.created_at) per food_id for the user
    - join to foods constrained to global-or-owned
    - order by that max timestamp desc

    NOTE: We intentionally don't attempt to include foods that are no longer in
    scope (e.g. another user's private food).
    """

    last_used_sq = (
        select(
            MealEntry.food_id.label("food_id"),
            MealEntry.created_at.label("used_at"),
        )
        .join(Food, Food.id == MealEntry.food_id)
        .join(Day, Day.id == MealEntry.day_id)
        .where(Day.user_id == user_id)
        .where(MealEntry.food_id.is_not(None))
        .where(or_(Food.user_id.is_(None), Food.user_id == user_id))
        .distinct(MealEntry.food_id)
        .order_by(MealEntry.food_id.asc(), MealEntry.created_at.desc())
        .subquery()
    )

    stmt = (
        select(Food)
        .join(last_used_sq, last_used_sq.c.food_id == Food.id)
        .order_by(last_used_sq.c.used_at.desc(), Food.name.asc())
        .limit(limit)
    )

    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_favorite_map_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    food_ids: list[uuid.UUID],
) -> dict[uuid.UUID, bool]:
    if not food_ids:
        return {}

    stmt = select(UserFoodFavorite.food_id).where(
        UserFoodFavorite.user_id == user_id,
        UserFoodFavorite.food_id.in_(food_ids),
    )
    res = await session.execute(stmt)
    fav_ids = set(res.scalars().all())
    return {fid: (fid in fav_ids) for fid in food_ids}


async def is_food_favorite(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    food_id: uuid.UUID,
) -> bool:
    stmt = select(exists().where(UserFoodFavorite.user_id == user_id, UserFoodFavorite.food_id == food_id))
    res = await session.execute(stmt)
    return bool(res.scalar())


async def get_food_for_user_scope(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    food_id: uuid.UUID,
) -> Food | None:
    stmt = select(Food).where(
        Food.id == food_id,
        or_(Food.user_id.is_(None), Food.user_id == user_id),
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def update_food_for_user_owned(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    food_id: uuid.UUID,
    name: str | None,
    brand: str | None,
    kcal_100g: float | None,
    protein_100g: float | None,
    carbs_100g: float | None,
    fat_100g: float | None,
) -> Food | None:
    # Only allow updating foods owned by user (not global)
    values: dict = {}
    if name is not None:
        values["name"] = name.strip()
    if brand is not None:
        values["brand"] = brand.strip() or None
    if kcal_100g is not None:
        values["kcal_100g"] = kcal_100g
    if protein_100g is not None:
        values["protein_100g"] = protein_100g
    if carbs_100g is not None:
        values["carbs_100g"] = carbs_100g
    if fat_100g is not None:
        values["fat_100g"] = fat_100g

    if not values:
        return await _get_owned_food(session=session, user_id=user_id, food_id=food_id)

    stmt = (
        update(Food)
        .where(and_(Food.id == food_id, Food.user_id == user_id))
        .values(**values)
        .returning(Food)
    )
    res = await session.execute(stmt)
    food = res.scalar_one_or_none()
    if food is None:
        return None
    await session.flush()
    return food


async def _get_owned_food(*, session: AsyncSession, user_id: uuid.UUID, food_id: uuid.UUID) -> Food | None:
    stmt = select(Food).where(Food.id == food_id, Food.user_id == user_id)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()
