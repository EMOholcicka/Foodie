import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { GroceryListRoute } from "./GroceryListRoute";

const mutateAsyncMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../api/plansQueries", async () => {
  const actual = await vi.importActual<any>("../api/plansQueries");
  return {
    ...actual,
    useWeeklyGroceryListQuery: () => ({
      isLoading: false,
      isError: false,
      data: {
        week_start: "2026-02-16",
        items: [
          {
            item_key: "milk",
            food_id: "f1",
            food_name: "Milk",
            total_grams: 100,
            checked: false,
            per_recipe: [],
          },
        ],
      },
    }),
    useBulkUpdateGroceryChecksMutation: () => ({
      mutateAsync: mutateAsyncMock,
    }),
  };
});

vi.mock("../domain/week", async () => {
  const actual = await vi.importActual<any>("../domain/week");
  return {
    ...actual,
    getWeekStartFromUrlOrStorage: () => "2026-02-16",
    persistLastWeekStart: () => undefined,
  };
});

describe("GroceryListRoute", () => {
  it("calls persistence mutation after debounce with correct payload", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <MemoryRouter initialEntries={["/plan/grocery?week=2026-02-16"]}>
        <GroceryListRoute />
      </MemoryRouter>
    );

    const cb = await screen.findByRole("checkbox", { name: "Check Milk" });
    await user.click(cb);

    expect(await screen.findByRole("checkbox", { name: "Uncheck Milk" })).toBeInTheDocument();

    // Debounced (300ms)
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(301);

    expect(mutateAsyncMock).toHaveBeenCalledWith([{ item_key: "milk", checked: true }]);

    vi.useRealTimers();
  });
});
