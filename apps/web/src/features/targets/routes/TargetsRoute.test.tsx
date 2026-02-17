import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { TargetsRoute } from "./TargetsRoute";

vi.mock("../api/targetsApi", () => {
  return {
    getTargets: vi.fn(async () => ({
      id: "t-1",
      effective_date: null,
      kcal_target: 2500,
      protein_g: 160,
      carbs_g: 280,
      fat_g: 80,
    })),
    putTargets: vi.fn(async (payload: any) => ({
      id: "t-1",
      effective_date: null,
      ...payload,
    })),
  };
});

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const renderWithLocalization = (globalThis as any).renderWithLocalization as (ui: React.ReactElement) => any;
  return renderWithLocalization(
    <QueryClientProvider client={client}>
      <TargetsRoute />
    </QueryClientProvider>
  );
}

describe("TargetsRoute", () => {
  it("loads existing targets and allows saving", async () => {
    const { putTargets } = await import("../api/targetsApi");
    const user = userEvent.setup();

    renderRoute();

    expect(await screen.findByDisplayValue("2500")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/kcal target/i));
    await user.type(screen.getByLabelText(/kcal target/i), "2400");

    await user.click(screen.getByRole("button", { name: /save targets/i }));

    await waitFor(() => expect(putTargets).toHaveBeenCalledTimes(1));
    expect(putTargets).toHaveBeenCalledWith(
      expect.objectContaining({
        kcal_target: 2400,
      })
    );

    expect(await screen.findByText(/targets saved/i)).toBeInTheDocument();
  });

  it("clears save feedback after edits and disables Save when unchanged", async () => {
    const user = userEvent.setup();

    renderRoute();

    const kcalField = await screen.findByLabelText(/kcal target/i);

    // unchanged -> disabled
    expect(screen.getByRole("button", { name: /save targets/i })).toBeDisabled();

    // edit -> enabled
    await user.clear(kcalField);
    await user.type(kcalField, "2400");
    expect(screen.getByRole("button", { name: /save targets/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /save targets/i }));
    expect(await screen.findByText(/targets saved/i)).toBeInTheDocument();

    // edit again -> snackbar should clear
    await user.clear(kcalField);
    await user.type(kcalField, "2300");

    await waitFor(() => expect(screen.queryByText(/targets saved/i)).not.toBeInTheDocument());
  });

  it("shows load failure state", async () => {
    const { getTargets } = await import("../api/targetsApi");
    (getTargets as any).mockImplementationOnce(async () => {
      throw new Error("nope");
    });

    renderRoute();

    expect(await screen.findByText(/failed to load targets/i)).toBeInTheDocument();
  });

  it("shows save failure state", async () => {
    const { putTargets } = await import("../api/targetsApi");
    (putTargets as any).mockImplementationOnce(async () => {
      throw new Error("bad");
    });

    const user = userEvent.setup();
    renderRoute();

    // Ensure the button is enabled
    await user.clear(await screen.findByLabelText(/kcal target/i));
    await user.type(screen.getByLabelText(/kcal target/i), "2400");

    await user.click(screen.getByRole("button", { name: /save targets/i }));

    expect(await screen.findByText(/failed to save targets/i)).toBeInTheDocument();
  });
});
