import type { Food } from "../../foods/api/foodsApi";
import type { Macros, RecipeItem } from "../api/recipesApi";

export type RecipeItemWithFood = RecipeItem & {
  food: Food;
};

export type RecipeComputed = {
  total: Macros;
  perServing: Macros;
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function computeFoodMacrosForGrams(food: Food, grams: number): Macros {
  const factor = grams / 100;
  return {
    kcal: food.kcal_100g * factor,
    protein: food.protein_100g * factor,
    carbs: food.carbs_100g * factor,
    fat: food.fat_100g * factor,
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function computeRecipeFromItems(items: RecipeItemWithFood[], servings: number): RecipeComputed {
  const total = sumMacros(items.map((i) => computeFoodMacrosForGrams(i.food, Number(i.grams) || 0)));
  const safeServings = servings > 0 ? servings : 1;
  const perServing = {
    kcal: total.kcal / safeServings,
    protein: total.protein / safeServings,
    carbs: total.carbs / safeServings,
    fat: total.fat / safeServings,
  };

  return {
    total: {
      kcal: round1(total.kcal),
      protein: round1(total.protein),
      carbs: round1(total.carbs),
      fat: round1(total.fat),
    },
    perServing: {
      kcal: round1(perServing.kcal),
      protein: round1(perServing.protein),
      carbs: round1(perServing.carbs),
      fat: round1(perServing.fat),
    },
  };
}
