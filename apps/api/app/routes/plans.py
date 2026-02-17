from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import plans as crud_plans
from app.db.session import get_db_session
from app.routes.deps import get_current_user
from app.schemas.plans import GroceryListOut, GroceryListItemOut, GenerateWeeklyPlanRequest, WeeklyPlanOut

router = APIRouter(prefix="/plans", tags=["plans"])


@router.post("/weekly/generate", response_model=WeeklyPlanOut, status_code=status.HTTP_201_CREATED)
async def generate_weekly_plan(
    payload: GenerateWeeklyPlanRequest,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    try:
        plan = await crud_plans.generate_weekly_plan_for_user(
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

    items: list[GroceryListItemOut] = []
    for food_id in sorted(totals_by_food_id.keys(), key=lambda x: str(x)):
        food = foods_by_id.get(food_id)
        items.append(
            GroceryListItemOut(
                food_id=food_id,
                food_name=food.name if food is not None else None,
                total_grams=totals_by_food_id[food_id],
                per_recipe=breakdown_by_food_id.get(food_id, []),
            )
        )

    return GroceryListOut(week_start=week_start, items=items)
