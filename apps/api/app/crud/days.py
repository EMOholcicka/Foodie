from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.day import Day
from app.models.food import Food
from app.models.meal_entry import MealEntry, MealType


async def get_or_create_day(*, session: AsyncSession, user_id: uuid.UUID, day_date: date) -> Day:
    stmt = select(Day).where(Day.user_id == user_id, Day.date == day_date)
    res = await session.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing is not None:
        return existing

    day = Day(user_id=user_id, date=day_date)
    session.add(day)
    await session.flush()
    await session.refresh(day)
    return day


async def add_meal_entries(
    *,
    session: AsyncSession,
    day_id: uuid.UUID,
    entries: list[dict],
) -> list[MealEntry]:
    created: list[MealEntry] = []
    for e in entries:
        entry = MealEntry(
            day_id=day_id,
            meal_type=e["meal_type"],
            food_id=e.get("food_id"),
            recipe_id=e.get("recipe_id"),
            grams=e["grams"],
            servings=e.get("servings"),
            serving_label=e.get("serving_label"),
        )
        session.add(entry)
        created.append(entry)

    await session.flush()
    for entry in created:
        await session.refresh(entry)
    return created


async def list_meal_entries_with_foods_for_day(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    day_date: date,
) -> tuple[Day | None, list[tuple[MealEntry, Food | None]]]:
    # Ensure the day is user-scoped.
    day_stmt = select(Day).where(Day.user_id == user_id, Day.date == day_date)
    day_res = await session.execute(day_stmt)
    day = day_res.scalar_one_or_none()
    if day is None:
        return None, []

    # Load entries and their foods (food can be null or deleted).
    # IMPORTANT: join must be scoped to the current user to avoid leaking
    # another user's private food macros if IDs ever collide or are guessed.
    stmt = (
        select(MealEntry, Food)
        .where(MealEntry.day_id == day.id)
        .join(
            Food,
            (Food.id == MealEntry.food_id)
            & ((Food.user_id == user_id) | (Food.user_id.is_(None))),
            isouter=True,
        )
        .order_by(MealEntry.meal_type.asc(), MealEntry.created_at.asc())
    )
    res = await session.execute(stmt)
    return day, list(res.all())


def compute_entry_macros(*, grams: float, food: Food | None) -> dict[str, float]:
    if food is None:
        return {"kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}

    factor = float(grams) / 100.0
    return {
        "kcal": float(food.kcal_100g) * factor,
        "protein_g": float(food.protein_100g) * factor,
        "carbs_g": float(food.carbs_100g) * factor,
        "fat_g": float(food.fat_100g) * factor,
    }


def compute_meal_and_day_totals(
    *,
    entries: list[tuple[MealEntry, Food | None]],
) -> tuple[dict[MealType, dict[str, float]], dict[str, float]]:
    meal_totals: dict[MealType, dict[str, float]] = defaultdict(lambda: {"kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0})
    day_totals = {"kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}

    for entry, food in entries:
        macros = compute_entry_macros(grams=float(entry.grams), food=food)
        mt = entry.meal_type
        for k in day_totals:
            meal_totals[mt][k] += macros[k]
            day_totals[k] += macros[k]

    return meal_totals, day_totals
