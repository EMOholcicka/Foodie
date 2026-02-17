from __future__ import annotations

import json
import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.foods import get_food_for_user_scope
from app.crud.recipes import get_recipe_for_user
from app.models.food import Food
from app.models.meal_entry import MealType
from app.models.recipe import Recipe
from app.models.weekly_plan import WeeklyPlan, WeeklyPlanDay, WeeklyPlanMeal
from app.schemas.plans import GenerateWeeklyPlanRequest, SwapWeeklyPlanMealRequest


_MEAL_SLOTS: tuple[MealType, ...] = (
    MealType.breakfast,
    MealType.lunch,
    MealType.dinner,
    MealType.snack,
)


def _stable_seed(*, user_id: uuid.UUID, week_start: date, target_kcal: int) -> int:
    # Keep deterministic across runs/processes.
    # user_id is a uuid; use int value to avoid hash randomization.
    return (user_id.int ^ (week_start.toordinal() << 8) ^ (target_kcal << 1)) & 0xFFFFFFFF


def _pick_index(*, seed: int, day_idx: int, meal_idx: int, n: int) -> int:
    # Small linear congruential mix for deterministic "random-like" selection.
    if n <= 0:
        return 0
    x = (seed + (day_idx + 1) * 1103515245 + (meal_idx + 1) * 12345) & 0x7FFFFFFF
    return x % n


async def get_weekly_plan_for_user(
    *, session: AsyncSession, user_id: uuid.UUID, week_start: date
) -> WeeklyPlan | None:
    stmt = (
        select(WeeklyPlan)
        .where(WeeklyPlan.user_id == user_id, WeeklyPlan.week_start == week_start)
        .options(selectinload(WeeklyPlan.days).selectinload(WeeklyPlanDay.meals))
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def delete_weekly_plan_for_user(*, session: AsyncSession, user_id: uuid.UUID, week_start: date) -> None:
    stmt = (
        delete(WeeklyPlan)
        .where(WeeklyPlan.user_id == user_id, WeeklyPlan.week_start == week_start)
        .execution_options(synchronize_session=False)
    )
    await session.execute(stmt)


async def _pg_advisory_xact_lock(*, session: AsyncSession, user_id: uuid.UUID, week_start: date) -> None:
    """Serialize weekly-plan writes by (user_id, week_start).

    In production (Postgres), we use `pg_advisory_xact_lock` so concurrent generate
    requests can't interleave.

    In tests we run on SQLite; in that environment the function doesn't exist.
    SQLite is already single-writer, and our tests use a single session/transaction,
    so we can safely no-op.
    """

    if session.bind is None:
        return

    dialect_name = session.bind.dialect.name
    if dialect_name != "postgresql":
        return

    # Two 32-bit key parts; stable across processes.
    # We fold UUID into int32 and combine with week_start ordinal.
    k1 = (user_id.int ^ 0xA5A5A5A5) & 0x7FFFFFFF
    k2 = (week_start.toordinal() ^ 0x5A5A5A5A) & 0x7FFFFFFF
    await session.execute(select(func.pg_advisory_xact_lock(k1, k2)))


async def _list_recipes_for_generation(*, session: AsyncSession, user_id: uuid.UUID) -> list[Recipe]:
    # Deterministic ordering: sort by UUID string.
    # NOTE: do not eager-load items here; it can create duplicate Recipe rows
    # on some backends. Items are loaded later when building the grocery list.
    stmt = select(Recipe).where(Recipe.user_id == user_id).order_by(Recipe.id.asc())
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def generate_weekly_plan_for_user(
    *, session: AsyncSession, user_id: uuid.UUID, payload: GenerateWeeklyPlanRequest
) -> WeeklyPlan:
    """Generate or regenerate a weekly plan.

    The caller controls the transaction scope (FastAPI request or test fixture).
    We must *not* open a new transaction here because tests run inside an
    already-open transaction.
    """

    await _pg_advisory_xact_lock(session=session, user_id=user_id, week_start=payload.week_start)

    recipes = await _list_recipes_for_generation(session=session, user_id=user_id)
    if not recipes:
        raise ValueError("No recipes available to generate a plan")

    seed = _stable_seed(user_id=user_id, week_start=payload.week_start, target_kcal=payload.target_kcal)

    macro_grams = payload.macro_grams
    protein_g = macro_grams.protein_g if macro_grams is not None else None
    carbs_g = macro_grams.carbs_g if macro_grams is not None else None
    fat_g = macro_grams.fat_g if macro_grams is not None else None

    training_schedule_json = (
        json.dumps([td.model_dump(mode="json") for td in payload.training_schedule])
        if payload.training_schedule
        else None
    )
    preferences_json = json.dumps(payload.preferences) if payload.preferences is not None else None

    # Lock existing plan row if present so we can update in place.
    existing_stmt = (
        select(WeeklyPlan)
        .where(WeeklyPlan.user_id == user_id, WeeklyPlan.week_start == payload.week_start)
        .options(selectinload(WeeklyPlan.days).selectinload(WeeklyPlanDay.meals))
        .with_for_update()
    )
    existing_res = await session.execute(existing_stmt)
    plan = existing_res.scalar_one_or_none()

    locked_by_key: dict[tuple[date, MealType], tuple[uuid.UUID, Decimal]] = {}

    if plan is None:
        plan = WeeklyPlan(
            user_id=user_id,
            week_start=payload.week_start,
            target_kcal=payload.target_kcal,
            protein_g=protein_g,
            carbs_g=carbs_g,
            fat_g=fat_g,
            training_schedule_json=training_schedule_json,
            preferences_json=preferences_json,
        )
        session.add(plan)
        await session.flush()  # allocate plan.id
    else:
        # Reload locked meals from DB to ensure we see out-of-band updates
        # (tests modify rows via raw SQL on the same connection).
        locked_stmt = (
            select(WeeklyPlanDay.date, WeeklyPlanMeal.meal_type, WeeklyPlanMeal.recipe_id, WeeklyPlanMeal.servings)
            .join(WeeklyPlanMeal, WeeklyPlanMeal.weekly_plan_day_id == WeeklyPlanDay.id)
            .where(WeeklyPlanDay.weekly_plan_id == plan.id, WeeklyPlanMeal.locked.is_(True))
        )
        locked_res = await session.execute(locked_stmt)
        for day_date, meal_type, recipe_id, servings in locked_res.all():
            locked_by_key[(day_date, meal_type)] = (recipe_id, Decimal(servings))

        # Update plan metadata in place.
        plan.target_kcal = payload.target_kcal
        plan.protein_g = protein_g
        plan.carbs_g = carbs_g
        plan.fat_g = fat_g
        plan.training_schedule_json = training_schedule_json
        plan.preferences_json = preferences_json

        # Replace children in the same transaction while keeping the plan row intact.
        await session.execute(
            delete(WeeklyPlanMeal)
            .where(
                WeeklyPlanMeal.weekly_plan_day_id.in_(
                    select(WeeklyPlanDay.id).where(WeeklyPlanDay.weekly_plan_id == plan.id)
                )
            )
            .execution_options(synchronize_session=False)
        )
        await session.execute(
            delete(WeeklyPlanDay)
            .where(WeeklyPlanDay.weekly_plan_id == plan.id)
            .execution_options(synchronize_session=False)
        )
        await session.flush()

    for day_idx in range(7):
        d = WeeklyPlanDay(weekly_plan_id=plan.id, date=payload.week_start + timedelta(days=day_idx))
        session.add(d)
        await session.flush()

        for meal_idx, meal_type in enumerate(_MEAL_SLOTS):
            key = (d.date, meal_type)
            locked = locked_by_key.get(key)
            if locked is not None:
                recipe_id, servings = locked
                locked_flag = True
            else:
                chosen = recipes[_pick_index(seed=seed, day_idx=day_idx, meal_idx=meal_idx, n=len(recipes))]
                recipe_id = chosen.id
                servings = Decimal("1.00")
                locked_flag = False

            session.add(
                WeeklyPlanMeal(
                    weekly_plan_day_id=d.id,
                    meal_type=meal_type,
                    recipe_id=recipe_id,
                    servings=servings,
                    locked=locked_flag,
                )
            )

    await session.flush()

    # Ensure relationships are loaded for the response without doing an extra query.
    await session.refresh(plan)
    await session.refresh(plan, attribute_names=["days"])
    for d in plan.days:
        await session.refresh(d, attribute_names=["meals"])

    return plan


async def swap_weekly_plan_meal_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    week_start: date,
    payload: SwapWeeklyPlanMealRequest,
) -> WeeklyPlan:
    await _pg_advisory_xact_lock(session=session, user_id=user_id, week_start=week_start)

    if payload.date < week_start or payload.date > (week_start + timedelta(days=6)):
        raise ValueError("date must be within the specified week")

    recipe = await get_recipe_for_user(session=session, user_id=user_id, recipe_id=payload.new_recipe_id)
    if recipe is None:
        raise ValueError("Recipe not found")

    plan_stmt = (
        select(WeeklyPlan)
        .where(WeeklyPlan.user_id == user_id, WeeklyPlan.week_start == week_start)
        .options(selectinload(WeeklyPlan.days).selectinload(WeeklyPlanDay.meals))
        .with_for_update()
    )
    plan_res = await session.execute(plan_stmt)
    plan = plan_res.scalar_one_or_none()
    if plan is None:
        raise ValueError("Weekly plan not found")

    day = next((d for d in plan.days if d.date == payload.date), None)
    if day is None:
        raise ValueError("Weekly plan day not found")

    meal = next((m for m in day.meals if m.meal_type == payload.meal_type), None)
    if meal is None:
        raise ValueError("Weekly plan meal slot not found")

    meal.recipe_id = recipe.id
    meal.locked = bool(payload.lock)
    await session.flush()

    await session.refresh(plan)
    await session.refresh(plan, attribute_names=["days"])
    for d in plan.days:
        await session.refresh(d, attribute_names=["meals"])

    return plan


async def grocery_list_for_weekly_plan(
    *, session: AsyncSession, user_id: uuid.UUID, plan: WeeklyPlan
) -> tuple[dict[uuid.UUID, Food], dict[uuid.UUID, Decimal], dict[uuid.UUID, list[dict]]]:
    """Return (foods_by_id, total_grams_by_food_id, breakdown_by_food_id).

    breakdown entries: {recipe_id, recipe_name, servings, grams}
    """

    # Collect recipe_id -> total servings across plan.
    servings_by_recipe_id: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0"))
    for d in plan.days:
        for m in d.meals:
            servings_by_recipe_id[m.recipe_id] += Decimal(m.servings)

    # Load recipes with items.
    recipe_ids = list(servings_by_recipe_id.keys())
    if not recipe_ids:
        return {}, {}, {}

    stmt = select(Recipe).where(Recipe.user_id == user_id, Recipe.id.in_(recipe_ids)).options(selectinload(Recipe.items))
    res = await session.execute(stmt)
    recipes = list(res.scalars().all())

    total_grams_by_food_id: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0"))
    breakdown_by_food_id: dict[uuid.UUID, list[dict]] = defaultdict(list)
    foods_by_id: dict[uuid.UUID, Food] = {}

    # Deterministic ordering for stable output.
    recipes.sort(key=lambda r: str(r.id))

    for r in recipes:
        total_servings = servings_by_recipe_id.get(r.id, Decimal("0"))
        if total_servings <= 0:
            continue

        factor = total_servings / Decimal(r.servings)
        for item in sorted(r.items, key=lambda i: str(i.id)):
            food = await get_food_for_user_scope(session=session, user_id=user_id, food_id=item.food_id)
            if food is None:
                raise ValueError(f"Unknown food referenced by recipe item: food_id={item.food_id}")
            foods_by_id[food.id] = food

            grams = (Decimal(item.grams) * factor).quantize(Decimal("0.01"))
            total_grams_by_food_id[food.id] += grams
            breakdown_by_food_id[food.id].append(
                {
                    "recipe_id": r.id,
                    "recipe_name": r.name,
                    "servings": total_servings,
                    "grams": grams,
                }
            )

    return foods_by_id, dict(total_grams_by_food_id), dict(breakdown_by_food_id)
