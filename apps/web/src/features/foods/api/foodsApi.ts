import { http } from "../../../shared/api/http";

export type Food = {
  id: string;
  owner: "global" | "user";
  is_favorite: boolean;
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
};

export type FoodListResponse = {
  items: Food[];
};

export type CreateFoodRequest = {
  name: string;
  brand?: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
};

export async function listFoods(params?: { query?: string; limit?: number }): Promise<Food[]> {
  const { data } = await http.get<FoodListResponse>("/foods", { params });
  return data.items;
}

export async function listFavoriteFoods(params?: { limit?: number }): Promise<Food[]> {
  const { data } = await http.get<FoodListResponse>("/foods/favorites", { params });
  return data.items;
}

export async function listRecentFoods(params?: { limit?: number }): Promise<Food[]> {
  const { data } = await http.get<FoodListResponse>("/foods/recent", { params });
  return data.items;
}

export async function favoriteFood(foodId: string): Promise<void> {
  await http.post(`/foods/${foodId}/favorite`);
}

export async function unfavoriteFood(foodId: string): Promise<void> {
  await http.delete(`/foods/${foodId}/favorite`);
}

export async function createFood(req: CreateFoodRequest): Promise<Food> {
  const { data } = await http.post<Food>("/foods", {
    ...req,
    brand: req.brand === "" ? null : req.brand ?? null,
  });
  return data;
}
