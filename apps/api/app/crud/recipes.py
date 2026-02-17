from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.foods import get_food_for_user_scope
from app.models.food import Food
from app.models.recipe import Recipe, RecipeItem


def _food_contrib(*, food: Food, grams: Decimal) -> dict[str, Decimal]:
    factor = grams / Decimal("100")

    # Food macros are stored as Numeric in DB and may come back as Decimal.
    kcal_100g = Decimal(str(food.kcal_100g))
    protein_100g = Decimal(str(food.protein_100g))
    carbs_100g = Decimal(str(food.carbs_100g))
    fat_100g = Decimal(str(food.fat_100g))

    return {
        "kcal": kcal_100g * factor,
        "protein": protein_100g * factor,
        "carbs": carbs_100g * factor,
        "fat": fat_100g * factor,
    }


async def compute_recipe_macros(
    *,
    session: AsyncSession,
    recipe: Recipe,
    user_id: uuid.UUID,
) -> tuple[dict[str, Decimal], dict[str, Decimal]]:
    total: dict[str, Decimal] = {
        "kcal": Decimal("0"),
        "protein": Decimal("0"),
        "carbs": Decimal("0"),
        "fat": Decimal("0"),
    }

    food_ids = [i.food_id for i in recipe.items]
    foods_by_id: dict[uuid.UUID, Food] = {}
    if food_ids:
        # Scope foods to current user: global foods + user-owned foods.
        stmt = select(Food).where(
            Food.id.in_(food_ids),
            or_(Food.user_id.is_(None), Food.user_id == user_id),
        )
        res = await session.execute(stmt)
        foods_by_id = {f.id: f for f in res.scalars().all()}

    for item in recipe.items:
        food = foods_by_id.get(item.food_id)
        if food is None:
            # Out-of-scope or missing foods are ignored to prevent cross-user leakage.
            continue
        contrib = _food_contrib(food=food, grams=item.grams)
        for k in total:
            total[k] += contrib[k]

    servings = Decimal(recipe.servings)
    per_serving = {k: (total[k] / servings) for k in total}
    return total, per_serving


async def create_recipe_for_user(
    *, session: AsyncSession, user_id: uuid.UUID, name: str, servings: int
) -> Recipe:
    recipe = Recipe(user_id=user_id, name=name.strip(), servings=servings)
    session.add(recipe)
    await session.flush()
    await session.refresh(recipe)
    return recipe


async def list_recipes_for_user(*, session: AsyncSession, user_id: uuid.UUID) -> list[Recipe]:
    stmt = (
        select(Recipe)
        .where(Recipe.user_id == user_id)
        .order_by(Recipe.created_at.desc())
        .options(selectinload(Recipe.items))
    )
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_recipe_for_user(*, session: AsyncSession, user_id: uuid.UUID, recipe_id: uuid.UUID) -> Recipe | None:
    stmt = (
        select(Recipe)
        .where(Recipe.user_id == user_id, Recipe.id == recipe_id)
        .options(selectinload(Recipe.items))
    )
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def update_recipe_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    recipe_id: uuid.UUID,
    name: str | None,
    servings: int | None,
) -> Recipe | None:
    values: dict = {}
    if name is not None:
        values["name"] = name.strip()
    if servings is not None:
        values["servings"] = servings

    if values:
        stmt = (
            update(Recipe)
            .where(Recipe.user_id == user_id, Recipe.id == recipe_id)
            .values(**values)
            .returning(Recipe)
        )
        res = await session.execute(stmt)
        recipe = res.scalar_one_or_none()
        if recipe is None:
            return None
        await session.flush()

    return await get_recipe_for_user(session=session, user_id=user_id, recipe_id=recipe_id)


async def delete_recipe_for_user(*, session: AsyncSession, user_id: uuid.UUID, recipe_id: uuid.UUID) -> bool:
    stmt = delete(Recipe).where(Recipe.user_id == user_id, Recipe.id == recipe_id).returning(Recipe.id)
    res = await session.execute(stmt)
    deleted_id = res.scalar_one_or_none()
    return deleted_id is not None


async def add_recipe_item_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    recipe_id: uuid.UUID,
    food_id: uuid.UUID,
    grams: Decimal,
) -> RecipeItem | None:
    recipe = await get_recipe_for_user(session=session, user_id=user_id, recipe_id=recipe_id)
    if recipe is None:
        return None

    food = await get_food_for_user_scope(session=session, user_id=user_id, food_id=food_id)
    if food is None:
        return None

    # Persist grams as Decimal to match Numeric DB type.
    item = RecipeItem(recipe_id=recipe.id, food_id=food.id, grams=grams)
    session.add(item)
    await session.flush()
    await session.refresh(item)
    return item


async def update_recipe_item_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    recipe_id: uuid.UUID,
    item_id: uuid.UUID,
    grams: Decimal,
) -> RecipeItem | None:
    recipe = await get_recipe_for_user(session=session, user_id=user_id, recipe_id=recipe_id)
    if recipe is None:
        return None

    stmt = (
        update(RecipeItem)
        .where(RecipeItem.id == item_id, RecipeItem.recipe_id == recipe.id)
        .values(grams=grams)
        .returning(RecipeItem)
    )
    res = await session.execute(stmt)
    item = res.scalar_one_or_none()
    if item is None:
        return None
    await session.flush()
    return item


async def delete_recipe_item_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    recipe_id: uuid.UUID,
    item_id: uuid.UUID,
) -> bool:
    recipe = await get_recipe_for_user(session=session, user_id=user_id, recipe_id=recipe_id)
    if recipe is None:
        return False

    stmt = delete(RecipeItem).where(RecipeItem.id == item_id, RecipeItem.recipe_id == recipe.id).returning(RecipeItem.id)
    res = await session.execute(stmt)
    deleted_id = res.scalar_one_or_none()
    return deleted_id is not None


async def get_recipe_macros_for_user(
    *, session: AsyncSession, user_id: uuid.UUID, recipe_id: uuid.UUID
) -> tuple[Recipe, dict[str, Decimal], dict[str, Decimal]] | None:
    recipe = await get_recipe_for_user(session=session, user_id=user_id, recipe_id=recipe_id)
    if recipe is None:
        return None
    total, per_serving = await compute_recipe_macros(session=session, recipe=recipe, user_id=user_id)
    return recipe, total, per_serving
