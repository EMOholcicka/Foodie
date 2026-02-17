import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { WeeklyPlanRoute } from "./WeeklyPlanRoute";

vi.mock("../api/plansApi", async () => {
  const actual = await vi.importActual<any>("../api/plansApi");
  return {
    ...actual,
    getWeeklyPlan: vi.fn(),
    swapWeeklyPlanMeal: vi.fn(),
  };
});

vi.mock("../../recipes/api/recipesApi", async () => {
  const actual = await vi.importActual<any>("../../recipes/api/recipesApi");
  return {
    ...actual,
    listRecipes: vi.fn(),
  };
});

function renderRoute(initialEntry: string) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <WeeklyPlanRoute />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test("swap modal lists recipes and triggers swap mutation", async () => {
  const plansApi = await import("../api/plansApi");
  const recipesApi = await import("../../recipes/api/recipesApi");

  (recipesApi.listRecipes as any).mockResolvedValue([
    { id: "r1", name: "Recipe 1", servings: 2, items: [] },
    { id: "r2", name: "Recipe 2", servings: 2, items: [] },
  ]);

  const plan = {
    week_start: "2026-02-16",
    totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    days: [
      {
        date: "2026-02-16",
        totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        meals: [
          {
            id: "m1",
            meal_type: "breakfast",
            recipe_id: "r1",
            recipe_name: "Recipe 1",
            totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
            locked: false,
          },
          {
            id: "m2",
            meal_type: "lunch",
            recipe_id: "r1",
            recipe_name: "Recipe 1",
            totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
            locked: false,
          },
          {
            id: "m3",
            meal_type: "dinner",
            recipe_id: "r1",
            recipe_name: "Recipe 1",
            totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
            locked: false,
          },
          {
            id: "m4",
            meal_type: "snack",
            recipe_id: "r1",
            recipe_name: "Recipe 1",
            totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
            locked: false,
          },
        ],
      },
      ...Array.from({ length: 6 }).map((_, i) => ({
        date: `2026-02-${17 + i}`,
        totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        meals: [],
      })),
    ],
  };

  (plansApi.getWeeklyPlan as any).mockResolvedValue(plan);

  (plansApi.swapWeeklyPlanMeal as any).mockImplementation(async (_weekStart: string, payload: any) => {
    return {
      ...plan,
      days: plan.days.map((d) => {
        if (d.date !== payload.date) return d;
        return {
          ...d,
          meals: d.meals.map((m: any) =>
            m.meal_type === payload.meal_type ? { ...m, recipe_id: payload.new_recipe_id, locked: true } : m,
          ),
        };
      }),
    };
  });

  renderRoute("/plan?week=2026-02-16");

  // Open Monday drawer
  fireEvent.click(await screen.findByLabelText("Open Monday"));

  // Open swap modal
  fireEvent.click(screen.getByLabelText("Swap breakfast"));
  expect(screen.getByRole("dialog", { name: "Swap meal" })).toBeInTheDocument();

  // Pick recipe 2
  const select = screen.getByTestId("swap-recipe-select");
  fireEvent.mouseDown(within(select).getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: "Recipe 2" }));

  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => {
    expect(plansApi.swapWeeklyPlanMeal).toHaveBeenCalledWith("2026-02-16", {
      date: "2026-02-16",
      meal_type: "breakfast",
      new_recipe_id: "r2",
      lock: true,
    });
  });

  // dialog closes
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Swap meal" })).not.toBeInTheDocument();
  });
});
