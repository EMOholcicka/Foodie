import { http } from "../../../shared/api/http";
import type { Food } from "../../foods/api/foodsApi";

export const dayQueryKeys = {
  root: ["day"] as const,
  byDate: (date: string) => ["day", date] as const,
};

export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealEntry = {
  id: string;
  meal_type: MealType;
  grams: number;
  food: Food | null;
  macros: MacroTotals;
};

export type Meal = {
  meal_type: MealType;
  entries: MealEntry[];
  totals: MacroTotals;
};

export type Day = {
  date: string; // YYYY-MM-DD
  meals: Meal[];
  totals: MacroTotals;
};

export type CreateMealEntryRequest = {
  meal_type: MealType;
  food_id: string;
  grams: number;
  servings?: number | null;
  serving_label?: string | null;
};

export type AddEntriesResponse = {
  date: string;
  added: MealEntry[];
};

export async function getDay(date: string): Promise<Day> {
  const { data } = await http.get<Day>(`/days/${date}`);
  return data;
}

export async function addDayEntries(date: string, entries: CreateMealEntryRequest[]): Promise<AddEntriesResponse> {
  const { data } = await http.post<AddEntriesResponse>(`/days/${date}/entries`, entries);
  return data;
}
