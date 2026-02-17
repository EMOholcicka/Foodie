import { http } from "../../../shared/api/http";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type WeeklyPlanMeal = {
  id: string;
  meal_type: MealType;
  recipe_id: string | null;
  recipe_name: string | null;
  totals: MacroTotals;
  locked: boolean;
};

export type WeeklyPlanDay = {
  date: string; // YYYY-MM-DD
  totals: MacroTotals;
  meals: WeeklyPlanMeal[];
};

export type WeeklyPlan = {
  week_start: string; // YYYY-MM-DD (Mon)
  days: WeeklyPlanDay[];
  totals: MacroTotals;
  created_at?: string;
  updated_at?: string;
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

export type GroceryListItem = {
  id: string;
  name: string;
  grams: number;
  category: string | null;
  recipe_id: string | null;
  recipe_name: string | null;
};

export type GroceryListResponse = {
  week_start: string;
  items: GroceryListItem[];
};

export async function generateWeeklyPlan(payload: WeeklyPlanGenerateRequest): Promise<WeeklyPlanGenerateResponse> {
  const { data } = await http.post<WeeklyPlanGenerateResponse>("/plans/weekly/generate", payload);
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
