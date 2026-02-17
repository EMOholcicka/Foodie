import type { CreateFoodRequest } from "../api/foodsApi";

type ValidationResult = {
  ok: boolean;
  errors: Partial<Record<keyof CreateFoodRequest, string>>;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateCreateFood(req: CreateFoodRequest): ValidationResult {
  const errors: ValidationResult["errors"] = {};

  if (!req.name || req.name.trim().length === 0) errors.name = "Name is required";

  const fields: (keyof Pick<CreateFoodRequest, "kcal_100g" | "protein_100g" | "carbs_100g" | "fat_100g">)[] = [
    "kcal_100g",
    "protein_100g",
    "carbs_100g",
    "fat_100g",
  ];

  for (const f of fields) {
    const v = req[f];
    if (!isFiniteNumber(v)) {
      errors[f] = "Must be a number";
      continue;
    }
    if (v < 0) {
      errors[f] = "Must be ≥ 0";
      continue;
    }
    if (f !== "kcal_100g" && v > 100) {
      errors[f] = "Must be ≤ 100";
    }
  }

  // Guardrail: computed kcal from macros should roughly match provided kcal.
  // This is UX-level validation only; backend currently doesn't enforce.
  if (!errors.kcal_100g && !errors.protein_100g && !errors.carbs_100g && !errors.fat_100g) {
    const computed = req.protein_100g * 4 + req.carbs_100g * 4 + req.fat_100g * 9;
    const delta = Math.abs(req.kcal_100g - computed);
    if (delta > 30) {
      errors.kcal_100g = `kcal looks off (macros imply ~${Math.round(computed)} kcal)`;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
