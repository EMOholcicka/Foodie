import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

type Recipe = {
  id: string;
  user_id: string;
  name: string;
  servings: number;
  created_at: string;
  updated_at: string;
  items: Array<{ id: string; food_id: string; grams: number; created_at: string; updated_at: string }>;
  total_macros: { kcal: number; protein: number; carbs: number; fat: number };
  macros_per_serving: { kcal: number; protein: number; carbs: number; fat: number };
};

vi.mock("../api/recipesQueries", () => {
  return {
    useRecipeQuery: vi.fn(),
    useCreateRecipeMutation: vi.fn(),
    useUpdateRecipeMutation: vi.fn(),
    useAddRecipeItemMutation: vi.fn(),
    useUpdateRecipeItemMutation: vi.fn(),
    useDeleteRecipeItemMutation: vi.fn(),
  };
});

vi.mock("../../foods/components/FoodSearchPanel", () => {
  interface FoodSearchPanelMockProps {
    onPickFood: (food: { id: string; name: string; owner: string }) => void;
  }

  return {
    FoodSearchPanel: ({ onPickFood }: FoodSearchPanelMockProps) => (
      <button type="button" onClick={() => onPickFood({ id: "food-1", name: "Chicken", owner: "user" })}>
        Pick Chicken
      </button>
    ),
  };
});

vi.mock("../../foods/components/CreateFoodDialog", () => {
  return {
    CreateFoodDialog: () => null,
  };
});

vi.mock("../../foods/api/foodsApi", () => {
  return {
    listFoods: vi.fn(async () => [
      {
        id: "food-1",
        owner: "user",
        name: "Chicken",
        brand: null,
        kcal_100g: 200,
        protein_100g: 30,
        carbs_100g: 0,
        fat_100g: 5,
      },
    ]),
  };
});

import {
  useAddRecipeItemMutation,
  useCreateRecipeMutation,
  useDeleteRecipeItemMutation,
  useRecipeQuery,
  useUpdateRecipeItemMutation,
  useUpdateRecipeMutation,
} from "../api/recipesQueries";
import { RecipeBuilderRoute } from "./RecipeBuilderRoute";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/recipes/new", element: <RecipeBuilderRoute /> },
      { path: "/recipes/:recipeId/edit", element: <RecipeBuilderRoute /> },
    ],
    {
      initialEntries: [path],
    },
  );

  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
}

describe("RecipeBuilderRoute", () => {
  it("create flow: creates recipe and navigates to edit", async () => {
    vi.mocked(useRecipeQuery).mockReturnValue({
      data: undefined,
      isSuccess: false,
      isLoading: false,
      isError: false,
    } as any);

    const mutateAsync = vi.fn(async () => ({ id: "r1" }));
    vi.mocked(useCreateRecipeMutation).mockReturnValue({ mutateAsync, isPending: false } as any);
    vi.mocked(useUpdateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useAddRecipeItemMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.mocked(useDeleteRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    const router = renderAt("/recipes/new");

    await userEvent.type(screen.getByLabelText(/name/i), "My recipe");
    await userEvent.clear(screen.getByLabelText(/servings/i));
    await userEvent.type(screen.getByLabelText(/servings/i), "3");

    expect(router.state.location.pathname).toBe("/recipes/new");

    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mutateAsync).toHaveBeenCalledWith({ name: "My recipe", servings: 3 });

    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/recipes/r1/edit"));
  });

  it("shows totals incomplete indicator when an item is unresolved", async () => {
    vi.mocked(useRecipeQuery).mockReturnValue({
      data: {
        id: "r1",
        user_id: "u1",
        name: "Recipe",
        servings: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [
          { id: "i1", food_id: "food-1", grams: 100, created_at: "", updated_at: "" },
          { id: "i2", food_id: "food-missing", grams: 50, created_at: "", updated_at: "" },
        ],
        total_macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        macros_per_serving: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      },
      isSuccess: true,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useCreateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useAddRecipeItemMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.mocked(useDeleteRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    renderAt("/recipes/r1/edit");

    expect(screen.getByText(/totals incomplete/i)).toBeInTheDocument();
    expect(screen.getByText(/food food-missing/i)).toBeInTheDocument();
  });

  it("invalid grams does not trigger mutation", async () => {
    vi.mocked(useRecipeQuery).mockReturnValue({
      data: {
        id: "r1",
        user_id: "u1",
        name: "Recipe",
        servings: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [{ id: "i1", food_id: "food-1", grams: 100, created_at: "", updated_at: "" }],
        total_macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        macros_per_serving: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      },
      isSuccess: true,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useCreateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useAddRecipeItemMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);

    const updateMutate = vi.fn();
    vi.mocked(useUpdateRecipeItemMutation).mockReturnValue({ mutate: updateMutate, isPending: false } as any);
    vi.mocked(useDeleteRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    renderAt("/recipes/r1/edit");

    const grams = screen.getByLabelText(/grams/i);
    await userEvent.clear(grams);
    await userEvent.type(grams, "0");
    await userEvent.tab();

    expect(updateMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/must be ≥ 1/i)).toBeInTheDocument();
  });

  it("enter key commits valid grams", async () => {
    vi.mocked(useRecipeQuery).mockReturnValue({
      data: {
        id: "r1",
        user_id: "u1",
        name: "Recipe",
        servings: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [{ id: "i1", food_id: "food-1", grams: 100, created_at: "", updated_at: "" }],
        total_macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        macros_per_serving: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      },
      isSuccess: true,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useCreateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useAddRecipeItemMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);

    const updateMutate = vi.fn();
    vi.mocked(useUpdateRecipeItemMutation).mockReturnValue({ mutate: updateMutate, isPending: false } as any);
    vi.mocked(useDeleteRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    renderAt("/recipes/r1/edit");

    const grams = screen.getByLabelText(/grams/i);
    await userEvent.clear(grams);
    await userEvent.type(grams, "150");

    expect(updateMutate).not.toHaveBeenCalled();

    await userEvent.keyboard("{Enter}");

    expect(updateMutate).toHaveBeenCalledWith(
      { itemId: "i1", payload: { grams: 150 } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("Enter then blur does not enqueue two grams mutations for same item", async () => {
    const serverRecipe: Recipe = {
      id: "r1",
      user_id: "u1",
      name: "Recipe",
      servings: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{ id: "i1", food_id: "food-1", grams: 100, created_at: "", updated_at: "" }],
      total_macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      macros_per_serving: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    };

    vi.mocked(useRecipeQuery).mockImplementation(() => {
      return {
        data: serverRecipe,
        isSuccess: true,
        isLoading: false,
        isError: false,
      } as any;
    });

    vi.mocked(useCreateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useAddRecipeItemMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);

    const updateMutate = vi.fn();
    let capturedOptions: any;
    vi.mocked(useUpdateRecipeItemMutation).mockReturnValue({
      mutate: vi.fn((vars: any, options: any) => {
        updateMutate(vars, options);
        capturedOptions = options;
        // keep in-flight; do not call onSuccess/onError
      }),
      isPending: false,
    } as any);
    vi.mocked(useDeleteRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    renderAt("/recipes/r1/edit");

    const grams = screen.getAllByLabelText(/^grams$/i)[0];
    await userEvent.clear(grams);
    await userEvent.type(grams, "150");

    // First trigger: Enter
    await userEvent.keyboard("{Enter}");
    // Second trigger: blur (tab away)
    await userEvent.tab();

    expect(updateMutate).toHaveBeenCalledTimes(1);
    // Enter doesn't blur, so we may still be "editing"; the spinner should still appear.
    expect(screen.getByLabelText(/saving grams/i)).toBeInTheDocument();

    // Resolve mutation successfully; should clear saving state
    capturedOptions?.onSuccess?.();

    await vi.waitFor(() => {
      expect(screen.queryByLabelText(/saving grams/i)).not.toBeInTheDocument();
    });
    expect(screen.getAllByLabelText(/^grams$/i)[0]).not.toBeDisabled();
  });

  it("shows per-row saving state during in-flight grams mutation and clears on success", async () => {
    const serverRecipe: Recipe = {
      id: "r1",
      user_id: "u1",
      name: "Recipe",
      servings: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{ id: "i1", food_id: "food-1", grams: 100, created_at: "", updated_at: "" }],
      total_macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      macros_per_serving: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    };

    vi.mocked(useRecipeQuery).mockImplementation(() => {
      return {
        data: serverRecipe,
        isSuccess: true,
        isLoading: false,
        isError: false,
      } as any;
    });

    vi.mocked(useCreateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useAddRecipeItemMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);

    let capturedOptions: any;
    vi.mocked(useUpdateRecipeItemMutation).mockReturnValue({
      mutate: vi.fn((_vars: any, options: any) => {
        capturedOptions = options;
        // keep in-flight (do not call onSuccess/onError)
      }),
      isPending: false,
    } as any);
    vi.mocked(useDeleteRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    renderAt("/recipes/r1/edit");

    const grams = screen.getAllByLabelText(/^grams$/i)[0];
    await userEvent.clear(grams);
    await userEvent.type(grams, "150");
    await userEvent.tab();

    expect(capturedOptions).toBeTruthy();

    expect(screen.getByText(/saving/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/saving grams/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^grams$/i)[0]).toBeDisabled();

    // Resolve mutation successfully
    capturedOptions?.onSuccess?.();

    await vi.waitFor(() => {
      expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/saving grams/i)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/^grams$/i)[0]).not.toBeDisabled();

    expect(screen.getByLabelText(/grams saved indicator/i)).toHaveTextContent(/saved/i);
  });

  it("clears per-row saved indicator on subsequent edit and shows dirty state until saved again", async () => {
    const serverRecipe: Recipe = {
      id: "r1",
      user_id: "u1",
      name: "Recipe",
      servings: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{ id: "i1", food_id: "food-1", grams: 100, created_at: "", updated_at: "" }],
      total_macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      macros_per_serving: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    };

    vi.mocked(useRecipeQuery).mockImplementation(() => {
      return {
        data: serverRecipe,
        isSuccess: true,
        isLoading: false,
        isError: false,
      } as any;
    });

    vi.mocked(useCreateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useAddRecipeItemMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);

    let lastOptions: any;
    vi.mocked(useUpdateRecipeItemMutation).mockReturnValue({
      mutate: vi.fn((_vars: any, options: any) => {
        lastOptions = options;
      }),
      isPending: false,
    } as any);
    vi.mocked(useDeleteRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    renderAt("/recipes/r1/edit");

    // First save to show Saved indicator
    const grams = screen.getAllByLabelText(/^grams$/i)[0];
    await userEvent.clear(grams);
    await userEvent.type(grams, "150");
    await userEvent.tab();

    expect(lastOptions?.onSuccess).toEqual(expect.any(Function));
    lastOptions?.onSuccess?.();

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/grams saved indicator/i)).toHaveTextContent(/saved/i);
    });

    // Edit again: should clear Saved; and show an unsaved/dirty state until saved again.
    await userEvent.type(grams, "0");

    expect(screen.queryByLabelText(/grams saved indicator/i)).not.toBeInTheDocument();

    // Trigger blur to commit (this enqueues a new mutation)
    await userEvent.tab();

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/grams saving indicator/i)).toHaveTextContent(/saving/i);
      expect(screen.getByLabelText(/saving grams/i)).toBeInTheDocument();
    });

    // Resolve second mutation successfully
    lastOptions?.onSuccess?.();

    await vi.waitFor(() => {
      expect(screen.queryByLabelText(/grams saving indicator/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/grams saved indicator/i)).toHaveTextContent(/saved/i);
    });
  });

  it("dirty/inFlight prevents seed overwrite during in-flight mutation", async () => {
    const serverRecipe: Recipe = {
      id: "r1",
      user_id: "u1",
      name: "Recipe",
      servings: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{ id: "i1", food_id: "food-1", grams: 100, created_at: "", updated_at: "" }],
      total_macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      macros_per_serving: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    };

    vi.mocked(useRecipeQuery).mockImplementation(() => {
      return {
        data: serverRecipe,
        isSuccess: true,
        isLoading: false,
        isError: false,
      } as any;
    });

    vi.mocked(useCreateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useAddRecipeItemMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);

    let capturedOptions: any;
    vi.mocked(useUpdateRecipeItemMutation).mockReturnValue({
      mutate: vi.fn((_vars: any, options: any) => {
        capturedOptions = options;
        // keep in-flight (do not call onSuccess/onError)
      }),
      isPending: false,
    } as any);
    vi.mocked(useDeleteRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const router = createMemoryRouter([{ path: "/recipes/:recipeId/edit", element: <RecipeBuilderRoute /> }], {
      initialEntries: ["/recipes/r1/edit"],
    });

    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const grams = screen.getAllByLabelText(/^grams$/i)[0];
    await userEvent.clear(grams);
    await userEvent.type(grams, "150");
    await userEvent.tab();

    expect(capturedOptions).toBeTruthy();

    // Simulate server refetch update while mutation is in-flight.
    serverRecipe.items = [{ id: "i1", food_id: "food-1", grams: 110, created_at: "", updated_at: "" }];
    rerender(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(screen.getAllByLabelText(/^grams$/i)[0]).toHaveValue("150");
  });

  it("onError shows save failed snackbar and keeps dirty flag", async () => {
    const serverRecipe: Recipe = {
      id: "r1",
      user_id: "u1",
      name: "Recipe",
      servings: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{ id: "i1", food_id: "food-1", grams: 100, created_at: "", updated_at: "" }],
      total_macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      macros_per_serving: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    };

    vi.mocked(useRecipeQuery).mockImplementation(() => {
      return {
        data: serverRecipe,
        isSuccess: true,
        isLoading: false,
        isError: false,
      } as any;
    });

    vi.mocked(useCreateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useUpdateRecipeMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.mocked(useAddRecipeItemMutation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);

    let lastOptions: any;
    vi.mocked(useUpdateRecipeItemMutation).mockReturnValue({
      mutate: vi.fn((_vars: any, options: any) => {
        lastOptions = options;
        options?.onError?.(new Error("nope"));
      }),
      isPending: false,
    } as any);
    vi.mocked(useDeleteRecipeItemMutation).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    const router = createMemoryRouter([{ path: "/recipes/:recipeId/edit", element: <RecipeBuilderRoute /> }], {
      initialEntries: ["/recipes/r1/edit"],
    });

    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(router.state.location.pathname).toBe("/recipes/r1/edit");

    const grams = screen.getByLabelText(/grams/i);
    await userEvent.clear(grams);
    await userEvent.type(grams, "150");
    await userEvent.tab();

    expect(lastOptions?.onError).toEqual(expect.any(Function));
    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();

    // Simulate server refetch update after failed save; value should remain dirty (150).
    serverRecipe.items = [{ id: "i1", food_id: "food-1", grams: 110, created_at: "", updated_at: "" }];

    // Re-render without remounting so local dirty state is preserved.
    rerender(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(screen.getAllByLabelText(/grams/i)[0]).toHaveValue("150");
  });
});
