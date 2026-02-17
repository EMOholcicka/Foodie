from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import recipes as crud_recipes
from app.db.session import get_db_session
from app.routes.deps import get_current_user
from app.schemas.recipes import (
    RecipeCreate,
    RecipeItemCreate,
    RecipeItemOut,
    RecipeItemUpdate,
    RecipeOut,
    RecipeUpdate,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _recipe_out(*, recipe, total, per_serving) -> RecipeOut:
    return RecipeOut(
        id=recipe.id,
        user_id=recipe.user_id,
        name=recipe.name,
        servings=recipe.servings,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
        items=[RecipeItemOut.model_validate(i) for i in recipe.items],
        total_macros=total,
        macros_per_serving=per_serving,
    )


@router.post("", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    payload: RecipeCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    recipe = await crud_recipes.create_recipe_for_user(
        session=session,
        user_id=current_user.id,
        name=payload.name,
        servings=payload.servings,
    )
    recipe = await crud_recipes.get_recipe_for_user(session=session, user_id=current_user.id, recipe_id=recipe.id)
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Recipe creation failed")
    total, per_serving = await crud_recipes.compute_recipe_macros(session=session, recipe=recipe, user_id=current_user.id)
    return _recipe_out(recipe=recipe, total=total, per_serving=per_serving)


@router.get("", response_model=list[RecipeOut])
async def list_recipes(
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    recipes = await crud_recipes.list_recipes_for_user(session=session, user_id=current_user.id)
    out: list[RecipeOut] = []
    for r in recipes:
        total, per_serving = await crud_recipes.compute_recipe_macros(session=session, recipe=r, user_id=current_user.id)
        out.append(_recipe_out(recipe=r, total=total, per_serving=per_serving))
    return out


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(
    recipe_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    res = await crud_recipes.get_recipe_macros_for_user(
        session=session,
        user_id=current_user.id,
        recipe_id=recipe_id,
    )
    if res is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    recipe, total, per_serving = res
    return _recipe_out(recipe=recipe, total=total, per_serving=per_serving)


@router.patch("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: uuid.UUID,
    payload: RecipeUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    recipe = await crud_recipes.update_recipe_for_user(
        session=session,
        user_id=current_user.id,
        recipe_id=recipe_id,
        name=payload.name,
        servings=payload.servings,
    )
    if recipe is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    total, per_serving = await crud_recipes.compute_recipe_macros(session=session, recipe=recipe, user_id=current_user.id)
    return _recipe_out(recipe=recipe, total=total, per_serving=per_serving)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    deleted = await crud_recipes.delete_recipe_for_user(
        session=session,
        user_id=current_user.id,
        recipe_id=recipe_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return None


@router.post("/{recipe_id}/items", response_model=RecipeItemOut, status_code=status.HTTP_201_CREATED)
async def add_item(
    recipe_id: uuid.UUID,
    payload: RecipeItemCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    item = await crud_recipes.add_recipe_item_for_user(
        session=session,
        user_id=current_user.id,
        recipe_id=recipe_id,
        food_id=payload.food_id,
        grams=payload.grams,
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe or food not found")
    return RecipeItemOut.model_validate(item)


@router.patch("/{recipe_id}/items/{item_id}", response_model=RecipeItemOut)
async def update_item(
    recipe_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: RecipeItemUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    item = await crud_recipes.update_recipe_item_for_user(
        session=session,
        user_id=current_user.id,
        recipe_id=recipe_id,
        item_id=item_id,
        grams=payload.grams,
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe item not found")
    return RecipeItemOut.model_validate(item)


@router.delete("/{recipe_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    recipe_id: uuid.UUID,
    item_id: uuid.UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user=Depends(get_current_user),
):
    deleted = await crud_recipes.delete_recipe_item_for_user(
        session=session,
        user_id=current_user.id,
        recipe_id=recipe_id,
        item_id=item_id,
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe item not found")
    return None
