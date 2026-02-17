import { describe, expect, it } from "vitest";

import { validateCreateFood } from "./foodValidation";

describe("validateCreateFood", () => {
  it("rejects empty name", () => {
    const v = validateCreateFood({
      name: " ",
      brand: null,
      kcal_100g: 10,
      protein_100g: 0,
      carbs_100g: 0,
      fat_100g: 0,
    });
    expect(v.ok).toBe(false);
    expect(v.errors.name).toBeTruthy();
  });

  it("rejects negative macros", () => {
    const v = validateCreateFood({
      name: "X",
      brand: null,
      kcal_100g: -1,
      protein_100g: 0,
      carbs_100g: 0,
      fat_100g: 0,
    });
    expect(v.ok).toBe(false);
    expect(v.errors.kcal_100g).toBeTruthy();
  });

  it("warns when kcal mismatch is large", () => {
    const v = validateCreateFood({
      name: "Y",
      brand: null,
      kcal_100g: 0,
      protein_100g: 30,
      carbs_100g: 30,
      fat_100g: 30,
    });
    expect(v.ok).toBe(false);
    expect(v.errors.kcal_100g).toMatch(/looks off/i);
  });

  it("accepts reasonable values", () => {
    const v = validateCreateFood({
      name: "Chicken",
      brand: null,
      kcal_100g: 165,
      protein_100g: 31,
      carbs_100g: 0,
      fat_100g: 3.6,
    });
    expect(v.ok).toBe(true);
  });
});
