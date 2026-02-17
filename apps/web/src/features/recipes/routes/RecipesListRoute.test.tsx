import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import type { Recipe } from "../api/recipesApi";

vi.mock("../api/recipesQueries", () => {
  return {
    useRecipesListQuery: vi.fn(),
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
});
