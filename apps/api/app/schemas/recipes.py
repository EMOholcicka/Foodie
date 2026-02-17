from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class Macros(BaseModel):
    kcal: Decimal
    protein: Decimal
    carbs: Decimal
    fat: Decimal


class RecipeItemBase(BaseModel):
    food_id: uuid.UUID
    grams: Decimal = Field(gt=0)


class RecipeItemCreate(RecipeItemBase):
    pass


class RecipeItemUpdate(BaseModel):
    grams: Decimal = Field(gt=0)


class RecipeItemOut(RecipeItemBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecipeBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    servings: int = Field(gt=0)
    tags: list[str] = Field(default_factory=list, max_length=30)


class RecipeCreate(RecipeBase):
    pass


class RecipeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    servings: int | None = Field(default=None, gt=0)
    tags: list[str] | None = Field(default=None, max_length=30)


class RecipeOut(RecipeBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    items: list[RecipeItemOut]

    total_macros: Macros
    macros_per_serving: Macros

    is_favorite: bool = False

    class Config:
        from_attributes = True
