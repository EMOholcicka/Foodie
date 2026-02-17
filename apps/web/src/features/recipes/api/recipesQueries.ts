import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addRecipeItem,
  createRecipe,
  deleteRecipeItem,
  favoriteRecipe,
  getRecipe,
  listRecipes,
  unfavoriteRecipe,
  updateRecipe,
  updateRecipeItem,
  type Recipe,
  type RecipeCreateRequest,
  type RecipeItem,
  type RecipeItemCreateRequest,
  type RecipeItemUpdateRequest,
  type RecipeUpdateRequest,
  type RecipesListParams,
} from "./recipesApi";

type RecipesListParamsInput = RecipesListParams | undefined;

export function normalizeRecipesListParams(params: RecipesListParamsInput) {
  const p = params ?? {};
  return {
    // normalize booleans to explicit true/false and avoid passing undefined keys
    high_protein: Boolean(p.high_protein),
    favorites_only: Boolean(p.favorites_only),
    // `tags` order shouldn't change the cache identity
    tags: (p.tags ?? [])
      .map(String)
      .map((t) => t.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
  } as const;
}

export const recipesQueryKeys = {
  root: ["recipes"] as const,
  list: (params?: RecipesListParamsInput) =>
    [...recipesQueryKeys.root, "list", normalizeRecipesListParams(params)] as const,
  detail: (id: string) => [...recipesQueryKeys.root, "detail", id] as const,
};

export function useRecipesListQuery(params?: RecipesListParamsInput) {
  return useQuery({
    queryKey: recipesQueryKeys.list(params),
    queryFn: () => listRecipes(params ?? {}),
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
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.root });
    },
  });
}

export function useUpdateRecipeMutation(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipeUpdateRequest) => updateRecipe(recipeId, payload),
    onSuccess: async (recipe: Recipe) => {
      qc.setQueryData(recipesQueryKeys.detail(recipeId), recipe);
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.root });
    },
  });
}

export function useAddRecipeItemMutation(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipeItemCreateRequest) => addRecipeItem(recipeId, payload),
    onSuccess: async (item: RecipeItem) => {
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.detail(recipeId) });
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.root });
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
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.root });
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
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.root });
    },
  });
}

export function useToggleRecipeFavoriteMutation(recipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (isFavorite: boolean) => {
      if (isFavorite) {
        await unfavoriteRecipe(recipeId);
      } else {
        await favoriteRecipe(recipeId);
      }
    },
    onMutate: async (isFavorite: boolean) => {
      await qc.cancelQueries({ queryKey: recipesQueryKeys.root });

      const prevEntries = qc.getQueriesData<Recipe[]>({ queryKey: recipesQueryKeys.root });

      for (const [key, data] of prevEntries) {
        if (!data) continue;
        qc.setQueryData<Recipe[]>(key, (old) => {
          if (!old) return old;
          return old.map((r) => (r.id === recipeId ? { ...r, is_favorite: !isFavorite } : r));
        });
      }

      const prevDetail = qc.getQueryData<Recipe>(recipesQueryKeys.detail(recipeId));
      if (prevDetail) {
        qc.setQueryData<Recipe>(recipesQueryKeys.detail(recipeId), { ...prevDetail, is_favorite: !isFavorite });
      }

      return { prevEntries, prevDetail };
    },
    onError: (_err, _isFavorite, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.prevEntries) qc.setQueryData(key, data);
      if (ctx.prevDetail) qc.setQueryData(recipesQueryKeys.detail(recipeId), ctx.prevDetail);
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.root });
      await qc.invalidateQueries({ queryKey: recipesQueryKeys.detail(recipeId) });
    },
  });
}
