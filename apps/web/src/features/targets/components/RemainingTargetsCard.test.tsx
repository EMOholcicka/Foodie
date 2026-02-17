import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { RemainingTargetsCard } from "./RemainingTargetsCard";

vi.mock("../api/targetsApi", () => {
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

function renderCard(totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const renderWithLocalization = (globalThis as any).renderWithLocalization as (ui: React.ReactElement) => any;
  return renderWithLocalization(
    <QueryClientProvider client={client}>
      <RemainingTargetsCard totals={totals} />
    </QueryClientProvider>
  );
}

describe("RemainingTargetsCard", () => {
  it("shows empty-state CTA when targets are not set (404)", async () => {
    const { getTargets } = await import("../api/targetsApi");

    (getTargets as any).mockImplementationOnce(async () => {
      const err: any = new Error("not found");
      err.response = { status: 404 };
      throw err;
    });

    renderCard({ kcal: 500, protein_g: 0, carbs_g: 0, fat_g: 0 });

    expect(await screen.findByText(/set targets to see remaining/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /set targets/i })).toHaveAttribute("href", "/targets");
  });

  it("shows error state + retry when targets request fails (non-404)", async () => {
    const { getTargets } = await import("../api/targetsApi");

    (getTargets as any).mockImplementationOnce(async () => {
      const err: any = new Error("server error");
      err.response = { status: 500 };
      throw err;
    });

    renderCard({ kcal: 500, protein_g: 0, carbs_g: 0, fat_g: 0 });

    expect(await screen.findByText(/failed to load targets/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("uses over-by semantics when kcal remaining is negative", async () => {
    renderCard({ kcal: 2100, protein_g: 0, carbs_g: 0, fat_g: 0 });

    expect(await screen.findByText("Over by")).toBeInTheDocument();
    expect(screen.getByLabelText(/over by kcal/i)).toHaveTextContent("100 kcal");
  });
});
