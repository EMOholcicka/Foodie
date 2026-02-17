from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import and_, delete, exists, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.foods import get_food_for_user_scope
from app.models.food import Food
from app.models.recipe import Recipe, RecipeItem
from app.models.recipe_tag import RecipeTag, RecipeTagLink
from app.models.user_recipe_favorite import UserRecipeFavorite


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
    *, session: AsyncSession, user_id: uuid.UUID, name: str, servings: int, tags: list[str] | None = None
) -> Recipe:
    recipe = Recipe(user_id=user_id, name=name.strip(), servings=servings)
    session.add(recipe)
    await session.flush()

    if tags:
        await set_recipe_tags_for_user(session=session, user_id=user_id, recipe_id=recipe.id, tags=tags)

    await session.refresh(recipe)
    return recipe


async def list_recipes_for_user(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    tags: list[str] | None = None,
    high_protein: bool = False,
    under_30_min: bool = False,
    favorites_only: bool = False,
) -> list[Recipe]:
    stmt = select(Recipe).where(Recipe.user_id == user_id)

    if favorites_only:
        stmt = stmt.join(UserRecipeFavorite, UserRecipeFavorite.recipe_id == Recipe.id).where(
            UserRecipeFavorite.user_id == user_id
        )

    if tags:
        tag_names = [t.strip().lower() for t in tags if t.strip()]
        if tag_names:
            stmt = (
                stmt.join(RecipeTagLink, RecipeTagLink.recipe_id == Recipe.id)
                .join(RecipeTag, RecipeTag.id == RecipeTagLink.tag_id)
                .where(func.lower(RecipeTag.name).in_(tag_names))
                .group_by(Recipe.id)
                .having(func.count(func.distinct(RecipeTag.id)) >= len(set(tag_names)))
            )

    # Postgres: compute protein per serving from recipe items and foods.
    if high_protein or under_30_min:
        # NOTE: under_30_min is not yet supported at DB-level (no duration field). Treated as no-op.
        # Keep the filter for API compatibility.
        pass

    # Eager-load items for macros computation.
    stmt = stmt.order_by(Recipe.created_at.desc()).options(selectinload(Recipe.items))

    res = await session.execute(stmt)
    recipes = list(res.scalars().all())

    if high_protein:
        # Filter in Python after computing macros to avoid complex DB numeric joins.
        out: list[Recipe] = []
        for r in recipes:
            _, per_serving = await compute_recipe_macros(session=session, recipe=r, user_id=user_id)
            if per_serving["protein"] >= Decimal("25"):
                out.append(r)
        recipes = out

    return recipes


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
    tags: list[str] | None,
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

    if tags is not None:
        await set_recipe_tags_for_user(session=session, user_id=user_id, recipe_id=recipe_id, tags=tags)

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


async def get_recipe_favorite_map_for_user(
    *, session: AsyncSession, user_id: uuid.UUID, recipe_ids: list[uuid.UUID]
) -> dict[uuid.UUID, bool]:
    if not recipe_ids:
        return {}
    stmt = select(UserRecipeFavorite.recipe_id).where(
        UserRecipeFavorite.user_id == user_id,
        UserRecipeFavorite.recipe_id.in_(recipe_ids),
    )
    res = await session.execute(stmt)
    fav_ids = set(res.scalars().all())
    return {rid: (rid in fav_ids) for rid in recipe_ids}


async def set_recipe_favorite(
    *, session: AsyncSession, user_id: uuid.UUID, recipe_id: uuid.UUID, is_favorite: bool
) -> None:
    if is_favorite:
        session.add(UserRecipeFavorite(user_id=user_id, recipe_id=recipe_id))
        return

    stmt = delete(UserRecipeFavorite).where(
        UserRecipeFavorite.user_id == user_id,
        UserRecipeFavorite.recipe_id == recipe_id,
    )
    await session.execute(stmt)


async def get_recipe_tag_names_for_user(
    *, session: AsyncSession, user_id: uuid.UUID, recipe_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[str]]:
    if not recipe_ids:
        return {}

    # Recipes are user-owned; enforce scope by joining recipes.
    stmt = (
        select(RecipeTagLink.recipe_id, RecipeTag.name)
        .join(Recipe, Recipe.id == RecipeTagLink.recipe_id)
        .join(RecipeTag, RecipeTag.id == RecipeTagLink.tag_id)
        .where(Recipe.user_id == user_id)
        .where(RecipeTagLink.recipe_id.in_(recipe_ids))
        .order_by(RecipeTag.name.asc())
    )
    res = await session.execute(stmt)
    out: dict[uuid.UUID, list[str]] = {rid: [] for rid in recipe_ids}
    for rid, name in res.all():
        out.setdefault(rid, []).append(name)
    return out


async def set_recipe_tags_for_user(
    *, session: AsyncSession, user_id: uuid.UUID, recipe_id: uuid.UUID, tags: list[str]
) -> None:
    recipe = await get_recipe_for_user(session=session, user_id=user_id, recipe_id=recipe_id)
    if recipe is None:
        # Caller handles 404.
        return

    normalized = []
    for t in tags:
        tt = " ".join(t.strip().split())
        if not tt:
            continue
        normalized.append(tt)

    # Deduplicate case-insensitively, keep first casing.
    seen: set[str] = set()
    deduped: list[str] = []
    for t in normalized:
        k = t.lower()
        if k in seen:
            continue
        seen.add(k)
        deduped.append(t)

    # Remove existing links.
    await session.execute(delete(RecipeTagLink).where(RecipeTagLink.recipe_id == recipe_id))

    if not deduped:
        return

    # Upsert tags by name.
    # Concurrency: recipe_tags.name is unique, so two concurrent requests could try
    # to insert the same tag. Handle by retrying after an IntegrityError.
    stmt = select(RecipeTag).where(func.lower(RecipeTag.name).in_([t.lower() for t in deduped]))
    res = await session.execute(stmt)
    existing = {t.name.lower(): t for t in res.scalars().all()}

    tag_ids: list[int] = []
    for name in deduped:
        key = name.lower()
        tag = existing.get(key)
        if tag is None:
            tag = RecipeTag(name=name)
            session.add(tag)
            try:
                await session.flush()
            except Exception as e:
                # IntegrityError is expected in races; re-select the row.
                from sqlalchemy.exc import IntegrityError

                if isinstance(e, IntegrityError):
                    await session.rollback()
                    res2 = await session.execute(select(RecipeTag).where(func.lower(RecipeTag.name) == key))
                    tag = res2.scalar_one()
                else:
                    raise
            existing[key] = tag
        tag_ids.append(tag.id)

    # Create links.
    for tid in tag_ids:
        session.add(RecipeTagLink(recipe_id=recipe_id, tag_id=tid))
