import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import type { Recipe } from "../api/recipesApi";

vi.mock("../api/recipesQueries", () => {
  return {
    useRecipesListQuery: vi.fn(),
    useToggleRecipeFavoriteMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});

import { useRecipesListQuery } from "../api/recipesQueries";
import { RecipesListRoute } from "./RecipesListRoute";

function makeRecipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: "r1",
    user_id: "u1",
    name: "Pasta",
    servings: 2,
    tags: [],
    is_favorite: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [],
    total_macros: { kcal: 600, protein: 30, carbs: 80, fat: 10 },
    macros_per_serving: { kcal: 300, protein: 15, carbs: 40, fat: 5 },
    ...overrides,
  };
}

function renderRoute() {
  const router = createMemoryRouter(
    [
      { path: "/recipes", element: <RecipesListRoute /> },
      { path: "/recipes/new", element: <div>New recipe</div> },
      { path: "/recipes/:recipeId", element: <div>Recipe details</div> },
    ],
    { initialEntries: ["/recipes"] },
  );

  render(<RouterProvider router={router} />);
  return router;
}

describe("RecipesListRoute", () => {
  it("shows empty state CTA when list is empty", async () => {
    vi.mocked(useRecipesListQuery).mockReturnValue({
      data: [],
      isSuccess: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const router = renderRoute();

    expect(screen.getByText("No recipes yet.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /create a recipe/i }));
    expect(router.state.location.pathname).toBe("/recipes/new");
  });

  it("filters recipes client-side by name", async () => {
    vi.mocked(useRecipesListQuery).mockReturnValue({
      data: [makeRecipe({ id: "a", name: "Chicken soup" }), makeRecipe({ id: "b", name: "Pasta" })],
      isSuccess: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderRoute();

    expect(screen.getByText("Chicken soup")).toBeInTheDocument();
    expect(screen.getByText("Pasta")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/search recipes/i), "chick");

    expect(screen.getByText("Chicken soup")).toBeInTheDocument();
    expect(screen.queryByText("Pasta")).toBeNull();
  });

  it("does not crash when the list query accidentally returns a wrapped response object", async () => {
    // Regression guard for the Docker runtime issue where `/recipes` returned `{ items: [...] }`
    // and `filtered.map` crashed.
    vi.mocked(useRecipesListQuery).mockReturnValue({
      data: { items: [makeRecipe({ id: "a", name: "Chicken soup" })] },
      isSuccess: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderRoute();

    expect(screen.getByText("Chicken soup")).toBeInTheDocument();
  });
  it("toggles favorites via pin button", async () => {
    const mutate = vi.fn();
    const { useToggleRecipeFavoriteMutation } = await import("../api/recipesQueries");
    vi.mocked(useToggleRecipeFavoriteMutation as any).mockReturnValue({ mutate, isPending: false });

    vi.mocked(useRecipesListQuery).mockReturnValue({
      data: [makeRecipe({ id: "a", name: "Chicken soup", is_favorite: false })],
      isSuccess: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderRoute();

    await userEvent.click(screen.getByRole("button", { name: /pin recipe/i }));
    expect(mutate).toHaveBeenCalledWith(false);
  });

  it("shows tag filter options based on data", async () => {
    vi.mocked(useRecipesListQuery).mockReturnValue({
      data: [makeRecipe({ id: "a", tags: ["Dinner"] }), makeRecipe({ id: "b", tags: ["Quick"] })],
      isSuccess: true,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderRoute();

    // opens the select
    await userEvent.click(screen.getByLabelText(/filter by tag/i));
    expect(await screen.findByText("Dinner")).toBeInTheDocument();
    expect(await screen.findByText("Quick")).toBeInTheDocument();
  });
});
