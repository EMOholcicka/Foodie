import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { DayRoute } from "./DayRoute";

const MOCK_DATE = "2026-02-17";

const mockUseParams = vi.fn<[], { date?: string }>(() => ({ date: MOCK_DATE }));
const mockNavigate = vi.fn();

let currentSearch = "";

vi.mock("react-router-dom", async () => {
  const actual: any = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => mockUseParams(),
    useNavigate: () => mockNavigate,
    useSearchParams: () => {
      const sp = new URLSearchParams(currentSearch);
      const setSp = (next: any) => {
        const nextSp = typeof next === "function" ? next(sp) : next;
        currentSearch = nextSp.toString();
      };
      return [sp, setSp];
    },
  };
});

vi.mock("../api/daysApi", () => {
  return {
    dayQueryKeys: {
      root: ["day"],
      byDate: (date: string) => ["day", date],
    },
    getDay: vi.fn(async () => ({
      date: MOCK_DATE,
      totals: { kcal: 1000, protein_g: 50, carbs_g: 100, fat_g: 20 },
      meals: [
        { meal_type: "breakfast", totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, entries: [] },
        { meal_type: "lunch", totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, entries: [] },
        { meal_type: "dinner", totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, entries: [] },
        { meal_type: "snack", totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, entries: [] },
      ],
    })),
    addDayEntries: vi.fn(async () => ({ date: MOCK_DATE, added: [] })),
  };
});

vi.mock("../../foods/api/foodsApi", () => {
  return {
    listFoods: vi.fn(async () => [
      {
        id: "food-1",
        owner: "global",
        name: "Banana",
        brand: null,
        kcal_100g: 89,
        protein_100g: 1.1,
        carbs_100g: 22.8,
        fat_100g: 0.3,
      },
    ]),
    createFood: vi.fn(),
  };
});

vi.mock("../../targets/api/targetsApi", () => {
  return {
    getTargets: vi.fn(async () => ({
      id: "t-1",
      effective_date: null,
      kcal_target: 2000,
      protein_g: 150,
      carbs_g: 200,
      fat_g: 60,
    })),
    putTargets: vi.fn(),
  };
});

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Provided by src/test/setup.tsx
  const renderWithLocalization = (globalThis as any).renderWithLocalization as (ui: React.ReactElement) => any;
  return renderWithLocalization(
    <QueryClientProvider client={client}>
      <DayRoute />
    </QueryClientProvider>
  );
}

describe("DayRoute", () => {
  beforeEach(async () => {
    // Prevent test state leakage across specs.
    currentSearch = "";

    // Reset router mocks.
    mockUseParams.mockReset();
    mockUseParams.mockImplementation(() => ({ date: MOCK_DATE }));
    mockNavigate.mockClear();

    // Clear API mocks that are reconfigured in individual tests.
    const daysApi = await import("../api/daysApi");
    (daysApi.getDay as any).mockClear?.();
    (daysApi.addDayEntries as any).mockReset?.();
    (daysApi.addDayEntries as any).mockImplementation(async () => ({ date: MOCK_DATE, added: [] }));

    const foodsApi = await import("../../foods/api/foodsApi");
    (foodsApi.listFoods as any).mockClear?.();
    (foodsApi.createFood as any).mockClear?.();

    const targetsApi = await import("../../targets/api/targetsApi");
    (targetsApi.getTargets as any).mockClear?.();
    (targetsApi.putTargets as any).mockClear?.();

    // Reduce MUI Select out-of-range warnings by aligning "now" with the mocked route date.
    // Avoid fake timers: `userEvent.setup()` and async flows can hang when timers are faked.
    vi.setSystemTime(new Date(`${MOCK_DATE}T12:00:00.000Z`));
  });

  it("renders remaining kcal/macros based on targets and day totals", async () => {
    renderRoute();

    expect(await screen.findByText(/remaining/i)).toBeInTheDocument();

    // Remaining: 2000 - 1000
    expect(await screen.findByLabelText(/remaining kcal/i)).toHaveTextContent(/1000 kcal/i);

    // Remaining macros: P 150-50=100, C 200-100=100, F 60-20=40
    expect(await screen.findByLabelText(/remaining protein/i)).toHaveTextContent(/p\s+remaining\s+100g/i);
    expect(await screen.findByLabelText(/remaining carbs/i)).toHaveTextContent(/c\s+remaining\s+100g/i);
    expect(await screen.findByLabelText(/remaining fat/i)).toHaveTextContent(/f\s+remaining\s+40g/i);
  });

  it("supports deep-linking meal picker via ?meal=...", async () => {
    currentSearch = "meal=lunch";
    renderRoute();

    expect(await screen.findByText(/add to lunch/i)).toBeInTheDocument();
  });

  describe("add-to-meal flow", () => {
    it("opens picker and detail, then calls addDayEntries", async () => {
      const { addDayEntries } = await import("../api/daysApi");
      const user = userEvent.setup();

      currentSearch = "";
      renderRoute();

      await user.click(await screen.findByRole("button", { name: /add food/i }));

      // Search is enabled only for length>=2, so typing is needed.
      await user.type(screen.getByRole("textbox", { name: /search/i }), "Ba");

      await user.click(await screen.findByText("Banana"));

      // Drawer button
      await user.click(await screen.findByRole("button", { name: /add to breakfast/i }));

      expect(addDayEntries).toHaveBeenCalledTimes(1);
      expect(addDayEntries).toHaveBeenCalledWith("2026-02-17", [expect.objectContaining({ meal_type: "breakfast", food_id: "food-1" })]);
    });

    it("quick-add from search result calls addDayEntries with 100g", async () => {
      const { addDayEntries } = await import("../api/daysApi");
      const user = userEvent.setup();

      currentSearch = "";
      renderRoute();

      await user.click(await screen.findByRole("button", { name: /add food/i }));
      await user.type(screen.getByRole("textbox", { name: /search/i }), "Ba");

      await user.click(await screen.findByRole("button", { name: /quick add 100g of banana/i }));

      expect(addDayEntries).toHaveBeenCalledWith("2026-02-17", [expect.objectContaining({ meal_type: "breakfast", food_id: "food-1", grams: 100 })]);

      // Parent closes picker on success; FoodSearchPanel should not show its own success snackbar by default.
      expect(screen.queryByText(/added 100g/i)).not.toBeInTheDocument();
    });

    it("does not allow closing the drawer via ESC/backdrop while add mutation is pending", async () => {
      const { addDayEntries } = await import("../api/daysApi");

      // Never resolve -> mutation stays pending, which should lock the drawer close behavior.
      (addDayEntries as any).mockImplementationOnce(
        () =>
          new Promise(() => {
            // intentionally unresolved
          })
      );

      const user = userEvent.setup();
      currentSearch = "";
      renderRoute();

      await user.click(await screen.findByRole("button", { name: /add food/i }));
      await user.type(screen.getByRole("textbox", { name: /search/i }), "Ba");
      await user.click(await screen.findByText("Banana"));

      const addButton = await screen.findByRole("button", { name: /add to breakfast/i });
      await user.click(addButton);

      // While pending, the drawer should remain open and the close icon should be disabled.
      expect(await screen.findByLabelText(/close/i)).toBeDisabled();

      await user.keyboard("{Escape}");
      expect(await screen.findByRole("button", { name: /add to breakfast/i })).toBeInTheDocument();

      // Backdrop click: click outside the drawer content.
      await user.click(document.body);
      expect(await screen.findByRole("button", { name: /add to breakfast/i })).toBeInTheDocument();
    });

    it("redirects invalid date params to today", async () => {
      mockUseParams.mockReturnValueOnce({ date: "not-a-date" });

      currentSearch = "";
      renderRoute();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/day\/\d{4}-\d{2}-\d{2}$/), { replace: true });
      });
    });

    it("does not query foods when not on the search tab", async () => {
      const { listFoods } = await import("../../foods/api/foodsApi");
      (listFoods as any).mockClear();

      const user = userEvent.setup();

      currentSearch = "";
      renderRoute();
      await user.click(await screen.findByRole("button", { name: /add food/i }));

      await user.click(screen.getByRole("tab", { name: /recent/i }));
      await user.type(screen.getByRole("textbox", { name: /search/i }), "Ba");

      await waitFor(() => {
        expect(listFoods).toHaveBeenCalledTimes(0);
      });
    });

    it("mutation error keeps UI open and shows error", async () => {
      const { addDayEntries } = await import("../api/daysApi");
      (addDayEntries as any).mockImplementationOnce(async () => {
        throw new Error("boom");
      });

      const user = userEvent.setup();

      currentSearch = "";
      renderRoute();

      await user.click(await screen.findByRole("button", { name: /add food/i }));
      await user.type(screen.getByRole("textbox", { name: /search/i }), "Ba");
      await user.click(await screen.findByText("Banana"));

      await user.click(await screen.findByRole("button", { name: /add to breakfast/i }));

      // Drawer stays open on failure
      expect(await screen.findByRole("button", { name: /add to breakfast/i })).toBeInTheDocument();

      // Snackbar / alert appears
      expect(await screen.findByText(/failed to add entry/i)).toBeInTheDocument();
    });
  });
});

