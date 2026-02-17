import { http } from "../../../shared/api/http";

export type Macros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type RecipeItem = {
  id: string;
  food_id: string;
  grams: number;
  created_at: string;
  updated_at: string;
};

export type Recipe = {
  id: string;
  user_id: string;
  name: string;
  servings: number;
  created_at: string;
  updated_at: string;
  items: RecipeItem[];
  total_macros: Macros;
  macros_per_serving: Macros;
};

export type RecipeCreateRequest = {
  name: string;
  servings: number;
};

export type RecipeUpdateRequest = {
  name?: string;
  servings?: number;
};

export type RecipeItemCreateRequest = {
  food_id: string;
  grams: number;
};

export type RecipeItemUpdateRequest = {
  grams: number;
};

export async function listRecipes(): Promise<Recipe[]> {
  const { data } = await http.get<Recipe[]>("/recipes");
  return data;
}

export async function getRecipe(recipeId: string): Promise<Recipe> {
  const { data } = await http.get<Recipe>(`/recipes/${recipeId}`);
  return data;
}

export async function createRecipe(payload: RecipeCreateRequest): Promise<Recipe> {
  const { data } = await http.post<Recipe>("/recipes", payload);
  return data;
}

export async function updateRecipe(recipeId: string, payload: RecipeUpdateRequest): Promise<Recipe> {
  const { data } = await http.patch<Recipe>(`/recipes/${recipeId}`, payload);
  return data;
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  await http.delete(`/recipes/${recipeId}`);
}

export async function addRecipeItem(recipeId: string, payload: RecipeItemCreateRequest): Promise<RecipeItem> {
  const { data } = await http.post<RecipeItem>(`/recipes/${recipeId}/items`, payload);
  return data;
}

export async function updateRecipeItem(
  recipeId: string,
  itemId: string,
  payload: RecipeItemUpdateRequest,
): Promise<RecipeItem> {
  const { data } = await http.patch<RecipeItem>(`/recipes/${recipeId}/items/${itemId}`, payload);
  return data;
}

export async function deleteRecipeItem(recipeId: string, itemId: string): Promise<void> {
  await http.delete(`/recipes/${recipeId}/items/${itemId}`);
}
