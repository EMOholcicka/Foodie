import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import { describe, expect, it, vi } from "vitest";

import { AddWeighInDialog } from "./AddWeighInDialog";

declare global {
  // provided by src/test/setup.ts
  // eslint-disable-next-line no-var
  var renderWithLocalization: (
    ui: React.ReactElement
  ) => ReturnType<typeof import("@testing-library/react").render>;
}

describe("AddWeighInDialog", () => {
  it("validates weight and blocks submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithLocalization(
      <AddWeighInDialog
        open
        submitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
        initial={{ datetime: dayjs("2026-02-17T10:00:00Z") }}
      />
    );

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    const weight = screen.getByLabelText("Weight (kg)");
    await user.type(weight, "10");
    await user.tab();

    expect(screen.getByText(/Minimum is 20 kg/i)).toBeInTheDocument();
    expect(save).toBeDisabled();
  });

  it("accepts comma decimal and submits payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithLocalization(
      <AddWeighInDialog
        open
        submitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
        initial={{ datetime: dayjs("2026-02-17T10:00:00Z") }}
      />
    );

    await user.type(screen.getByLabelText("Weight (kg)"), "80,5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const draft = onSubmit.mock.calls[0]![0];
    expect(draft.weight_kg).toBeCloseTo(80.5, 6);
    expect(typeof draft.datetime).toBe("string");
  });

  it("resets draft state on open", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const initial = { datetime: dayjs("2026-02-17T10:00:00Z") };

    const { unmount } = renderWithLocalization(
      <AddWeighInDialog
        open
        submitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
        initial={initial}
      />
    );

    await user.type(screen.getByLabelText("Weight (kg)"), "88");
    expect((screen.getByLabelText("Weight (kg)") as HTMLInputElement).value).toContain("88");

    // Simulate close (unmount) then open again (fresh mount).
    unmount();

    renderWithLocalization(
      <AddWeighInDialog
        open
        submitting={false}
        onClose={() => {}}
        onSubmit={onSubmit}
        initial={initial}
      />
    );

    expect((screen.getByLabelText("Weight (kg)") as HTMLInputElement).value).toBe("");
  });
});
