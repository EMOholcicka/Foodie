import { describe, expect, it } from "vitest";

import { sumEntryMacros, sumMealTotals } from "./totals";
import type { MealEntry, Meal } from "../api/daysApi";

describe("day totals helpers", () => {
  it("sums entry macros", () => {
    const entries: MealEntry[] = [
      {
        id: "1",
        meal_type: "breakfast",
        grams: 100,
        food: null,
        macros: { kcal: 100.11, protein_g: 10, carbs_g: 20, fat_g: 5 },
      },
      {
        id: "2",
        meal_type: "breakfast",
        grams: 50,
        food: null,
        macros: { kcal: 50, protein_g: 5.5, carbs_g: 0, fat_g: 1 },
      },
    ];

    expect(sumEntryMacros(entries)).toEqual({
      kcal: 150.11,
      protein_g: 15.5,
      carbs_g: 20,
      fat_g: 6,
    });
  });

  it("sums meal totals", () => {
    const meals: Meal[] = [
      {
        meal_type: "breakfast",
        entries: [],
        totals: { kcal: 10, protein_g: 1, carbs_g: 2, fat_g: 3 },
      },
      {
        meal_type: "lunch",
        entries: [],
        totals: { kcal: 20.5, protein_g: 0, carbs_g: 3.5, fat_g: 0 },
      },
    ];

    expect(sumMealTotals(meals)).toEqual({
      kcal: 30.5,
      protein_g: 1,
      carbs_g: 5.5,
      fat_g: 3,
    });
  });
});
