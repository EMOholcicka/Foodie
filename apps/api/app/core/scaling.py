from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MacroTotals:
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float


def scale_macros_to_kcal(*, base: MacroTotals, kcal_target: float) -> MacroTotals:
    if kcal_target < 0:
        raise ValueError("kcal_target must be non-negative")

    base_kcal = float(base.kcal)
    if base_kcal <= 0:
        raise ValueError("base.kcal must be > 0")

    factor = float(kcal_target) / base_kcal
    return MacroTotals(
        kcal=float(kcal_target),
        protein_g=base.protein_g * factor,
        carbs_g=base.carbs_g * factor,
        fat_g=base.fat_g * factor,
    )
