from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.models.meal_entry import MealType


class MacroTotals(BaseModel):
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float


class MealEntryCreate(BaseModel):
    meal_type: MealType
    food_id: uuid.UUID | None = None
    recipe_id: uuid.UUID | None = None

    grams: float = Field(gt=0)

    # Optional UX fields. We accept them but do not compute with them yet.
    servings: float | None = Field(default=None, gt=0)
    serving_label: str | None = Field(default=None, max_length=50)

    @field_validator("serving_label")
    @classmethod
    def _empty_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v2 = v.strip()
        return v2 or None


class MealEntryOut(BaseModel):
    id: str
    meal_type: MealType
    grams: float

    food: dict | None
    macros: MacroTotals


class MealOut(BaseModel):
    meal_type: MealType
    entries: list[MealEntryOut]
    totals: MacroTotals


class DayOut(BaseModel):
    date: date
    meals: list[MealOut]
    totals: MacroTotals


class DayAddEntriesOut(BaseModel):
    date: date
    added: list[MealEntryOut]
