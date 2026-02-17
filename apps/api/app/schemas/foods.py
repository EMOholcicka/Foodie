from __future__ import annotations

import uuid

from pydantic import BaseModel, Field, field_validator


def _validate_macro_100g(v: float, *, field_name: str) -> float:
    if v < 0:
        raise ValueError(f"{field_name} must be >= 0")
    # Guardrail: macros per 100g over 100 are unrealistic for grams-based macros.
    # kcal can exceed 100.
    if field_name != "kcal_100g" and v > 100:
        raise ValueError(f"{field_name} must be <= 100")
    return v


class FoodBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    brand: str | None = Field(default=None, max_length=120)

    kcal_100g: float
    protein_100g: float
    carbs_100g: float
    fat_100g: float

    @field_validator("kcal_100g")
    @classmethod
    def _kcal(cls, v: float) -> float:
        return _validate_macro_100g(v, field_name="kcal_100g")

    @field_validator("protein_100g")
    @classmethod
    def _protein(cls, v: float) -> float:
        return _validate_macro_100g(v, field_name="protein_100g")

    @field_validator("carbs_100g")
    @classmethod
    def _carbs(cls, v: float) -> float:
        return _validate_macro_100g(v, field_name="carbs_100g")

    @field_validator("fat_100g")
    @classmethod
    def _fat(cls, v: float) -> float:
        return _validate_macro_100g(v, field_name="fat_100g")


class FoodCreate(FoodBase):
    # When true, create a global food (admin-like). For now disallow via API.
    pass


class FoodUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    brand: str | None = Field(default=None, max_length=120)

    kcal_100g: float | None = None
    protein_100g: float | None = None
    carbs_100g: float | None = None
    fat_100g: float | None = None

    @field_validator("kcal_100g")
    @classmethod
    def _kcal(cls, v: float | None) -> float | None:
        if v is None:
            return None
        return _validate_macro_100g(v, field_name="kcal_100g")

    @field_validator("protein_100g")
    @classmethod
    def _protein(cls, v: float | None) -> float | None:
        if v is None:
            return None
        return _validate_macro_100g(v, field_name="protein_100g")

    @field_validator("carbs_100g")
    @classmethod
    def _carbs(cls, v: float | None) -> float | None:
        if v is None:
            return None
        return _validate_macro_100g(v, field_name="carbs_100g")

    @field_validator("fat_100g")
    @classmethod
    def _fat(cls, v: float | None) -> float | None:
        if v is None:
            return None
        return _validate_macro_100g(v, field_name="fat_100g")


class FoodOut(FoodBase):
    id: str
    owner: str  # 'global' | 'user'
    is_favorite: bool = False

    @classmethod
    def from_model(cls, food, *, is_favorite: bool = False) -> "FoodOut":
        return cls(
            id=str(food.id),
            owner=("global" if food.user_id is None else "user"),
            is_favorite=is_favorite,
            name=food.name,
            brand=food.brand,
            kcal_100g=float(food.kcal_100g),
            protein_100g=float(food.protein_100g),
            carbs_100g=float(food.carbs_100g),
            fat_100g=float(food.fat_100g),
        )


class FoodListOut(BaseModel):
    items: list[FoodOut]
