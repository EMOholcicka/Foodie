from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


def macro_kcal(*, protein_g: Decimal, carbs_g: Decimal, fat_g: Decimal) -> Decimal:
    return protein_g * Decimal("4") + carbs_g * Decimal("4") + fat_g * Decimal("9")


class TargetsBase(BaseModel):
    effective_date: date | None = None

    kcal_target: int = Field(ge=0)
    protein_g: Decimal = Field(ge=0)
    carbs_g: Decimal = Field(ge=0)
    fat_g: Decimal = Field(ge=0)

    @model_validator(mode="after")
    def _validate_macros(self) -> "TargetsBase":
        # Optional: minimum protein guard (very mild; can be tuned later)
        if self.kcal_target > 0 and self.protein_g < 20:
            raise ValueError("protein_g must be at least 20g")

        # Macro kcal consistency: tolerate rounding and fiber labeling differences.
        kcal_from_macros = macro_kcal(protein_g=self.protein_g, carbs_g=self.carbs_g, fat_g=self.fat_g)
        diff = abs(Decimal(self.kcal_target) - kcal_from_macros)

        # Tolerance: max(50 kcal, 5% of target)
        tol = max(Decimal("50"), Decimal(self.kcal_target) * Decimal("0.05"))
        if diff > tol:
            raise ValueError(
                f"Macros kcal mismatch: kcal_target={self.kcal_target} vs macros≈{kcal_from_macros} (diff {diff} > tol {tol})"
            )

        return self


class TargetsSetRequest(TargetsBase):
    pass


class TargetsOut(TargetsBase):
    id: str
