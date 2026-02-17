import type { Day, MacroTotals, Meal, MealEntry } from "../api/daysApi";

export function emptyTotals(): MacroTotals {
  return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
}

export function addTotals(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    kcal: a.kcal + b.kcal,
    protein_g: a.protein_g + b.protein_g,
    carbs_g: a.carbs_g + b.carbs_g,
    fat_g: a.fat_g + b.fat_g,
  };
}

export function sumEntryMacros(entries: MealEntry[]): MacroTotals {
  return entries.reduce((acc, e) => addTotals(acc, e.macros), emptyTotals());
}

export function sumMealTotals(meals: Meal[]): MacroTotals {
  return meals.reduce((acc, m) => addTotals(acc, m.totals), emptyTotals());
}

export function getMeal(day: Day, mealType: Meal["meal_type"]): Meal {
  const found = day.meals.find((m) => m.meal_type === mealType);
  if (!found) {
    return { meal_type: mealType, entries: [], totals: emptyTotals() };
  }
  return found;
}
