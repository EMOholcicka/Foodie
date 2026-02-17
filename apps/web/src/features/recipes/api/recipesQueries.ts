import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addRecipeItem,
  createRecipe,
  deleteRecipeItem,
  getRecipe,
  listRecipes,
  updateRecipe,
  updateRecipeItem,
  type Recipe,
  type RecipeCreateRequest,
  type RecipeItem,
  type RecipeItemCreateRequest,
  type RecipeItemUpdateRequest,
  type RecipeUpdateRequest,
} from "./recipesApi";

export const recipesQueryKeys = {
  root: ["recipes"] as const,
  list: () => [...recipesQueryKeys.root, "list"] as const,
  detail: (id: string) => [...recipesQueryKeys.root, "detail", id] as const,
};

export function useRecipesListQuery() {
  return useQuery({
    queryKey: recipesQueryKeys.list(),
    queryFn: listRecipes,
    retry: false,
  });
}

export function useRecipeQuery(recipeId: string) {
  return useQuery({
    queryKey: recipesQueryKeys.detail(recipeId),
    queryFn: () => getRecipe(recipeId),
    enabled: !!recipeId,
    retry: false,
  });
}

export function useCreateRecipeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipeCreateRequest) => createRecipe(payload),
    onSuccess: async (recipe: Recipe) => {
      qc.setQueryData(recipesQueryKeys.detail(recipe.id), recipe);
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.list() });
    },
  });
}

export function useUpdateRecipeMutation(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipeUpdateRequest) => updateRecipe(recipeId, payload),
    onSuccess: async (recipe: Recipe) => {
      qc.setQueryData(recipesQueryKeys.detail(recipeId), recipe);
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.list() });
    },
  });
}

export function useAddRecipeItemMutation(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipeItemCreateRequest) => addRecipeItem(recipeId, payload),
    onSuccess: async (item: RecipeItem) => {
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.detail(recipeId) });
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.list() });
      return item;
    },
  });
}

export function useUpdateRecipeItemMutation(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: RecipeItemUpdateRequest }) =>
      updateRecipeItem(recipeId, itemId, payload),
    onSuccess: async (item: RecipeItem) => {
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.detail(recipeId) });
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.list() });
      return item;
    },
  });
}

export function useDeleteRecipeItemMutation(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deleteRecipeItem(recipeId, itemId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.detail(recipeId) });
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.list() });
    },
  });
}
