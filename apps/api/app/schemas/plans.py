from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models.meal_entry import MealType
from app.schemas.recipes import Macros


class MacroSplitPercent(BaseModel):
    protein_pct: int = Field(ge=0, le=100)
    carbs_pct: int = Field(ge=0, le=100)
    fat_pct: int = Field(ge=0, le=100)

    @model_validator(mode="after")
    def _sum_100(self) -> "MacroSplitPercent":
        if self.protein_pct + self.carbs_pct + self.fat_pct != 100:
            raise ValueError("Macro split percentages must sum to 100")
        return self


class MacroGrams(BaseModel):
    protein_g: int | None = Field(default=None, ge=0)
    carbs_g: int | None = Field(default=None, ge=0)
    fat_g: int | None = Field(default=None, ge=0)


class TrainingDay(BaseModel):
    date: date
    name: str | None = Field(default=None, max_length=100)


class GenerateWeeklyPlanRequest(BaseModel):
    week_start: date = Field(description="Monday of the week")
    target_kcal: int = Field(gt=0)

    # Optional macros.
    macro_split_pct: MacroSplitPercent | None = None
    macro_grams: MacroGrams | None = None

    # Optional context (stored as json snapshots in plan).
    training_schedule: list[TrainingDay] | None = None
    preferences: dict | None = None

    @model_validator(mode="after")
    def _week_start_is_monday(self) -> "GenerateWeeklyPlanRequest":
        # Python: Monday=0 .. Sunday=6
        if self.week_start.weekday() != 0:
            raise ValueError("week_start must be a Monday")
        return self

    @model_validator(mode="after")
    def _only_one_macro_mode(self) -> "GenerateWeeklyPlanRequest":
        if self.macro_split_pct is not None and self.macro_grams is not None:
            raise ValueError("Provide at most one of macro_split_pct or macro_grams")
        return self


class WeeklyPlanMealOut(BaseModel):
    id: uuid.UUID
    meal_type: MealType
    recipe_id: uuid.UUID
    servings: Decimal
    locked: bool

    class Config:
        from_attributes = True


class WeeklyPlanDayOut(BaseModel):
    id: uuid.UUID
    date: date
    meals: list[WeeklyPlanMealOut]

    totals: Macros | None = None

    class Config:
        from_attributes = True


class WeeklyPlanOut(BaseModel):
    id: uuid.UUID
    week_start: date
    target_kcal: int
    protein_g: int | None
    carbs_g: int | None
    fat_g: int | None

    days: list[WeeklyPlanDayOut]

    class Config:
        from_attributes = True


class GroceryListBreakdownItem(BaseModel):
    recipe_id: uuid.UUID
    recipe_name: str | None = None
    servings: Decimal
    grams: Decimal


class GroceryListItemOut(BaseModel):
    food_id: uuid.UUID
    food_name: str | None = None
    total_grams: Decimal
    per_recipe: list[GroceryListBreakdownItem] = Field(default_factory=list)


class GroceryListOut(BaseModel):
    week_start: date
    items: list[GroceryListItemOut]
