from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import plans as crud_plans
from app.db.session import get_db_session
from app.routes.deps import get_current_user
from app.schemas.plans import (
    GroceryListChecksBulkUpdateRequest,
    GroceryListOut,
    GroceryListItemOut,
    GenerateWeeklyPlanRequest,
    SwapWeeklyPlanMealRequest,
    WeeklyPlanOut,
)

router = APIRouter(prefix="/plans", tags=["plans"])


@router.post("/weekly/generate", response_model=WeeklyPlanOut, status_code=status.HTTP_201_CREATED)
async def generate_weekly_plan(
    payload: GenerateWeeklyPlanRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    try:
        plan, summary = await crud_plans.generate_weekly_plan_for_user(
            session=session,
            user_id=current_user.id,
            payload=payload,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # Ensure generated plan children are flushed so they are visible in the
    # current transaction/connection. Avoid committing here so regeneration is
    # atomic and tests can control rollback.
    await session.flush()

    out = WeeklyPlanOut.model_validate(plan)
    out.generation_summary = summary
    return out


@router.patch("/weekly/{week_start}/meals:swap", response_model=WeeklyPlanOut)
async def swap_weekly_plan_meal(
    week_start: date,
    payload: SwapWeeklyPlanMealRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    try:
        plan = await crud_plans.swap_weekly_plan_meal_for_user(
            session=session,
            user_id=current_user.id,
            week_start=week_start,
            payload=payload,
        )
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    await session.flush()
    return WeeklyPlanOut.model_validate(plan)


@router.patch("/weekly/{week_start}/meals/{meal_id}", response_model=WeeklyPlanOut)
async def toggle_weekly_plan_meal_lock(
    week_start: date,
    meal_id: str,
    *,
    locked: bool,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    try:
        import uuid

        plan = await crud_plans.set_weekly_plan_meal_lock_for_user(
            session=session,
            user_id=current_user.id,
            week_start=week_start,
            meal_id=uuid.UUID(meal_id),
            locked=locked,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid meal_id")
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    await session.flush()
    return WeeklyPlanOut.model_validate(plan)


@router.get("/weekly/{week_start}", response_model=WeeklyPlanOut)
async def get_weekly_plan(
    week_start: date,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    plan = await crud_plans.get_weekly_plan_for_user(session=session, user_id=current_user.id, week_start=week_start)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weekly plan not found")
    return WeeklyPlanOut.model_validate(plan)


@router.get("/weekly/{week_start}/grocery-list", response_model=GroceryListOut)
async def get_weekly_plan_grocery_list(
    week_start: date,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    plan = await crud_plans.get_weekly_plan_for_user(session=session, user_id=current_user.id, week_start=week_start)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weekly plan not found")

    try:
        foods_by_id, totals_by_food_id, breakdown_by_food_id = await crud_plans.grocery_list_for_weekly_plan(
            session=session,
            user_id=current_user.id,
            plan=plan,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    checked_by_key = await crud_plans._checked_map_for_week(session=session, user_id=current_user.id, week_start=week_start)

    items: list[GroceryListItemOut] = []
    for food_id in sorted(totals_by_food_id.keys(), key=lambda x: str(x)):
        food = foods_by_id.get(food_id)
        if food is None:
            # Fallback: still return stable key based on food_id.
            item_key = f"food_id:{food_id}"
            food_name = None
        else:
            item_key = crud_plans.grocery_item_key_from_food(food=food)
            food_name = food.name

        items.append(
            GroceryListItemOut(
                item_key=item_key,
                food_id=food_id,
                food_name=food_name,
                total_grams=totals_by_food_id[food_id],
                checked=checked_by_key.get(item_key, False),
                per_recipe=breakdown_by_food_id.get(food_id, []),
            )
        )

    return GroceryListOut(week_start=week_start, items=items)


@router.put("/weekly/{week_start}/grocery-list/checks", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_update_grocery_list_checks(
    week_start: date,
    payload: GroceryListChecksBulkUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    # Ensure plan exists for consistent UX.
    plan = await crud_plans.get_weekly_plan_for_user(session=session, user_id=current_user.id, week_start=week_start)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weekly plan not found")

    await crud_plans.bulk_upsert_grocery_item_checks(
        session=session,
        user_id=current_user.id,
        week_start=week_start,
        items=[(it.item_key, it.checked) for it in payload.items],
    )

    return None
