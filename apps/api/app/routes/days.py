from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.days import (
    add_meal_entries,
    compute_entry_macros,
    compute_meal_and_day_totals,
    get_or_create_day,
    list_meal_entries_with_foods_for_day,
)
from app.crud.foods import get_food_for_user_scope
from app.db.session import get_db_session
from app.models.user import User
from app.routes.deps import get_current_user
from app.models.meal_entry import MealType
from app.schemas.days import (
    DayAddEntriesOut,
    DayOut,
    MacroTotals,
    MealEntryCreate,
    MealEntryOut,
    MealOut,
)

router = APIRouter(prefix="/days", tags=["days"])


def _totals_out(d: dict[str, float]) -> MacroTotals:
    # Round to 2 decimals for stable JSON/tests.
    return MacroTotals(
        kcal=round(d["kcal"], 2),
        protein_g=round(d["protein_g"], 2),
        carbs_g=round(d["carbs_g"], 2),
        fat_g=round(d["fat_g"], 2),
    )


def _entry_out(entry, food) -> MealEntryOut:
    macros = compute_entry_macros(grams=float(entry.grams), food=food)
    food_out = None
    if food is not None:
        food_out = {
            "id": str(food.id),
            "name": food.name,
            "brand": food.brand,
            "kcal_100g": float(food.kcal_100g),
            "protein_100g": float(food.protein_100g),
            "carbs_100g": float(food.carbs_100g),
            "fat_100g": float(food.fat_100g),
            "owner": ("global" if food.user_id is None else "user"),
        }

    return MealEntryOut(
        id=str(entry.id),
        meal_type=entry.meal_type,
        grams=float(entry.grams),
        food=food_out,
        macros=_totals_out(macros),
    )


@router.post("/{day_date}/entries", response_model=DayAddEntriesOut, status_code=status.HTTP_201_CREATED)
async def add_entries(
    day_date: date = Path(..., description="Day date in YYYY-MM-DD"),
    payload: list[MealEntryCreate] = None,  # type: ignore[assignment]
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> DayAddEntriesOut:
    if payload is None or len(payload) == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one entry is required")

    # Validate food ownership scope for each entry.
    for e in payload:
        if (e.food_id is None) == (e.recipe_id is None):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Exactly one of food_id or recipe_id must be provided",
            )
        if e.food_id is not None:
            food = await get_food_for_user_scope(session=session, user_id=user.id, food_id=e.food_id)
            if food is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")

    day = await get_or_create_day(session=session, user_id=user.id, day_date=day_date)
    created = await add_meal_entries(
        session=session,
        day_id=day.id,
        entries=[e.model_dump() for e in payload],
    )
    await session.commit()

    # Re-load with foods for output.
    _, pairs = await list_meal_entries_with_foods_for_day(session=session, user_id=user.id, day_date=day_date)
    created_map = {c.id for c in created}
    added_out = [_entry_out(entry, food) for entry, food in pairs if entry.id in created_map]

    return DayAddEntriesOut(date=day_date, added=added_out)


@router.get("/{day_date}", response_model=DayOut)
async def get_day(
    day_date: date = Path(..., description="Day date in YYYY-MM-DD"),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> DayOut:
    day, pairs = await list_meal_entries_with_foods_for_day(session=session, user_id=user.id, day_date=day_date)
    if day is None:
        # Return empty day (UX-friendly) rather than 404.
        empty = {"kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
        return DayOut(
            date=day_date,
            meals=[
                MealOut(meal_type=mt, entries=[], totals=_totals_out(empty))
                for mt in ["breakfast", "lunch", "dinner", "snack"]
            ],
            totals=_totals_out(empty),
        )

    meal_totals, day_totals = compute_meal_and_day_totals(entries=pairs)

    by_meal: dict[str, list[MealEntryOut]] = {"breakfast": [], "lunch": [], "dinner": [], "snack": []}
    for entry, food in pairs:
        by_meal[entry.meal_type.value].append(_entry_out(entry, food))

    meals: list[MealOut] = []
    for mt in ["breakfast", "lunch", "dinner", "snack"]:
        totals = meal_totals.get(MealType(mt), {"kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0})
        meals.append(MealOut(meal_type=MealType(mt), entries=by_meal[mt], totals=_totals_out(totals)))

    return DayOut(date=day.date, meals=meals, totals=_totals_out(day_totals))
