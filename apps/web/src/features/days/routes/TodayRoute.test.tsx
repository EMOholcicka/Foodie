import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { TodayRoute } from "./TodayRoute";

const mockNavigate = vi.fn();

vi.mock("../api/daysApi", () => {
  return {
    dayQueryKeys: {
      root: ["day"],
      byDate: (date: string) => ["day", date],
    },
    getDay: vi.fn(async () => ({
      date: "2026-02-17",
      totals: { kcal: 500, protein_g: 10, carbs_g: 20, fat_g: 5 },
      meals: [
        { meal_type: "breakfast", totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, entries: [] },
        { meal_type: "lunch", totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, entries: [] },
        { meal_type: "dinner", totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, entries: [] },
        { meal_type: "snack", totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, entries: [] },
      ],
    })),
  };
});

vi.mock("../../targets/api/targetsApi", () => {
  return {
    getTargets: vi.fn(async () => ({
      id: "t-1",
      effective_date: null,
      kcal_target: 2000,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    })),
    putTargets: vi.fn(),
  };
});

vi.mock("react-router-dom", async () => {
  const actual: any = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const renderWithLocalization = (globalThis as any).renderWithLocalization as (ui: React.ReactElement) => any;
  return renderWithLocalization(
    <QueryClientProvider client={client}>
      <TodayRoute />
    </QueryClientProvider>
  );
}

describe("TodayRoute", () => {
  it("renders remaining kcal (kcal-only targets)", async () => {
    renderRoute();

    // Remaining: 2000 - 500
    expect(await screen.findByText(/1500 kcal/i)).toBeInTheDocument();

    // Macros should not render when targets are zeroed
    expect(screen.queryByText(/p /i)).not.toBeInTheDocument();
    expect(screen.queryByText(/c /i)).not.toBeInTheDocument();
    expect(screen.queryByText(/f /i)).not.toBeInTheDocument();
  });

  it("meal rows have Add actions that deep-link to Day with meal param", async () => {
    renderRoute();

    await screen.findByRole("button", { name: /add to breakfast/i });
    expect(screen.getByRole("button", { name: /add to lunch/i })).toBeInTheDocument();

    screen.getByRole("button", { name: /add to breakfast/i }).click();
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/day\/\d{4}-\d{2}-\d{2}\?meal=breakfast/));
  });

  it("renders persistent add-food fab", async () => {
    renderRoute();

    const fab = await screen.findByRole("button", { name: /add food/i });
    expect(fab).toBeInTheDocument();
  });
});
