from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.foods import create_food_for_user, list_foods_for_user, update_food_for_user_owned
from app.db.session import get_db_session
from app.models.user import User
from app.routes.deps import get_current_user
from app.schemas.foods import FoodCreate, FoodListOut, FoodOut, FoodUpdate

router = APIRouter(prefix="/foods", tags=["foods"])


@router.post("", response_model=FoodOut, status_code=status.HTTP_201_CREATED)
async def create_food(
    payload: FoodCreate,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> FoodOut:
    try:
        food = await create_food_for_user(
            session=session,
            user_id=user.id,
            name=payload.name,
            brand=payload.brand,
            kcal_100g=payload.kcal_100g,
            protein_100g=payload.protein_100g,
            carbs_100g=payload.carbs_100g,
            fat_100g=payload.fat_100g,
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Food with same name/brand already exists")

    return FoodOut.from_model(food)


@router.get("", response_model=FoodListOut)
async def list_foods(
    query: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> FoodListOut:
    items = await list_foods_for_user(session=session, user_id=user.id, query=query, limit=limit)
    return FoodListOut(items=[FoodOut.from_model(i) for i in items])


@router.put("/{food_id}", response_model=FoodOut)
async def update_food(
    food_id: uuid.UUID,
    payload: FoodUpdate,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> FoodOut:
    try:
        food = await update_food_for_user_owned(
            session=session,
            user_id=user.id,
            food_id=food_id,
            name=payload.name,
            brand=(payload.brand if payload.brand is not None else None),
            kcal_100g=payload.kcal_100g,
            protein_100g=payload.protein_100g,
            carbs_100g=payload.carbs_100g,
            fat_100g=payload.fat_100g,
        )
        if food is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Food with same name/brand already exists")

    return FoodOut.from_model(food)
