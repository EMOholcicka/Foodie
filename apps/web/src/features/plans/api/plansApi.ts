import { http } from "../../../shared/api/http";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

// NOTE: weekly plan API currently returns only IDs + lock/servings.
// Display names are resolved client-side from the recipes cache/query.

export type WeeklyPlanMeal = {
  id: string;
  meal_type: MealType;
  recipe_id: string;
  servings: number;
  locked: boolean;
};

export type WeeklyPlanDay = {
  id: string;
  date: string; // YYYY-MM-DD
  meals: WeeklyPlanMeal[];

  // Optional; backend may add this later.
  totals?: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null;
};

export type WeeklyPlanGenerationSummary = {
  locked_kept: number;
  locked_changed: number;
  unlocked_changed: number;
};

export type WeeklyPlan = {
  id: string;
  week_start: string; // YYYY-MM-DD (Mon)
  target_kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  days: WeeklyPlanDay[];

  generation_summary?: WeeklyPlanGenerationSummary | null;
};

export type WeeklyPlanGenerateRequest = {
  week_start: string; // YYYY-MM-DD
  template: "recomp_2200";
  target_kcal: number;
  training_schedule: {
    mon: "lift" | "run" | "rest";
    tue: "lift" | "run" | "rest";
    wed: "lift" | "run" | "rest";
    thu: "lift" | "run" | "rest";
    fri: "lift" | "run" | "rest";
    sat: "lift" | "run" | "rest";
    sun: "lift" | "run" | "rest";
  };
  preferences?: {
    vegetarian?: boolean;
    dairy_free?: boolean;
    gluten_free?: boolean;
  };
};

export type WeeklyPlanGenerateResponse = WeeklyPlan;

// Grocery list endpoint returns `item_key`, `food_id`, `food_name`, `total_grams`, `checked`, `per_recipe`.
export type GroceryListItem = {
  item_key: string;
  food_id: string;
  food_name: string | null;
  total_grams: number;
  checked: boolean;
  per_recipe: Array<{
    recipe_id: string;
    recipe_name: string | null;
    servings: number;
    grams: number;
  }>;
};

export type GroceryListResponse = {
  week_start: string;
  items: GroceryListItem[];
};

export async function generateWeeklyPlan(payload: WeeklyPlanGenerateRequest): Promise<WeeklyPlanGenerateResponse> {
  const { data } = await http.post<WeeklyPlanGenerateResponse>("/plans/weekly/generate", payload);
  return data;
}

export type SwapWeeklyPlanMealRequest = {
  date: string; // YYYY-MM-DD
  meal_type: MealType;
  new_recipe_id: string;
  lock?: boolean; // default true
};

export async function swapWeeklyPlanMeal(weekStart: string, payload: SwapWeeklyPlanMealRequest): Promise<WeeklyPlan> {
  const { data } = await http.patch<WeeklyPlan>(`/plans/weekly/${weekStart}/meals:swap`, payload);
  return data;
}

export async function setWeeklyPlanMealLock(weekStart: string, mealId: string, locked: boolean): Promise<WeeklyPlan> {
  const { data } = await http.patch<WeeklyPlan>(`/plans/weekly/${weekStart}/meals/${mealId}`, undefined, {
    params: { locked },
  });
  return data;
}

export async function getWeeklyPlan(weekStart: string): Promise<WeeklyPlan> {
  const { data } = await http.get<WeeklyPlan>(`/plans/weekly/${weekStart}`);
  return data;
}

export async function getWeeklyGroceryList(weekStart: string): Promise<GroceryListResponse> {
  const { data } = await http.get<GroceryListResponse>(`/plans/weekly/${weekStart}/grocery-list`);
  return data;
}

export type GroceryChecksBulkUpdateRequest = {
  items: Array<{ item_key: string; checked: boolean }>;
};

export async function bulkUpdateGroceryChecks(weekStart: string, payload: GroceryChecksBulkUpdateRequest): Promise<void> {
  await http.put(`/plans/weekly/${weekStart}/grocery-list/checks`, payload);
}
