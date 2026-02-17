from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.foods import (
    create_food_for_user,
    get_favorite_map_for_user,
    get_food_for_user_scope,
    list_favorites_for_user,
    list_foods_for_user,
    list_recent_for_user,
    set_favorite,
    update_food_for_user_owned,
)
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
    include_favorite: bool = Query(default=False),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> FoodListOut:
    items = await list_foods_for_user(session=session, user_id=user.id, query=query, limit=limit)
    fav_map = (
        await get_favorite_map_for_user(session=session, user_id=user.id, food_ids=[i.id for i in items])
        if include_favorite
        else {}
    )
    return FoodListOut(items=[FoodOut.from_model(i, is_favorite=fav_map.get(i.id, False)) for i in items])


@router.get("/favorites", response_model=FoodListOut)
async def list_favorites(
    limit: int = Query(default=50, ge=1, le=100),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> FoodListOut:
    items = await list_favorites_for_user(session=session, user_id=user.id, limit=limit)
    return FoodListOut(items=[FoodOut.from_model(i, is_favorite=True) for i in items])


@router.get("/recent", response_model=FoodListOut)
async def list_recent(
    limit: int = Query(default=20, ge=1, le=50),
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> FoodListOut:
    items = await list_recent_for_user(session=session, user_id=user.id, limit=limit)
    fav_map = await get_favorite_map_for_user(session=session, user_id=user.id, food_ids=[i.id for i in items])
    return FoodListOut(items=[FoodOut.from_model(i, is_favorite=fav_map.get(i.id, False)) for i in items])


@router.post("/{food_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def favorite_food(
    food_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> Response:
    food = await get_food_for_user_scope(session=session, user_id=user.id, food_id=food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")

    try:
        await set_favorite(session=session, user_id=user.id, food_id=food_id, is_favorite=True)
        await session.commit()
    except IntegrityError:
        # Unique violation if already favorited; treat as idempotent.
        await session.rollback()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{food_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def unfavorite_food(
    food_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    user: User = Depends(get_current_user),
) -> Response:
    food = await get_food_for_user_scope(session=session, user_id=user.id, food_id=food_id)
    if food is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")

    await set_favorite(session=session, user_id=user.id, food_id=food_id, is_favorite=False)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
