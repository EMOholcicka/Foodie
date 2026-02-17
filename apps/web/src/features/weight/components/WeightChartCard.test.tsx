import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import { describe, expect, it, vi } from "vitest";

import { WeightChartCard } from "./WeightChartCard";

declare global {
  // provided by src/test/setup.ts
  // eslint-disable-next-line no-var
  var renderWithLocalization: (
    ui: React.ReactElement
  ) => ReturnType<typeof import("@testing-library/react").render>;
}

describe("WeightChartCard", () => {
  it("renders title row, tool row (range control), legend, and footer", () => {
    renderWithLocalization(<WeightChartCard points={[]} />);

    expect(screen.getByText("Weight")).toBeInTheDocument();
    expect(screen.getByText("Range")).toBeInTheDocument();

    const group = screen.getByRole("group", { name: /weight chart range/i });
    expect(group).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /last 7 days/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last 30 days/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last 90 days/i })).toBeInTheDocument();

    const legend = screen.getByLabelText(/weight chart legend/i);
    expect(legend).toHaveTextContent(/weigh-ins/i);
    expect(legend).toHaveTextContent(/7-pt avg/i);

    expect(screen.getByText(/moving average: trailing 7 points/i)).toBeInTheDocument();
  });

  it("shows inset empty state with Add weigh-in CTA and dispatches weights:add", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(document, "dispatchEvent");

    renderWithLocalization(<WeightChartCard points={[]} />);

    expect(screen.getByTestId("weight-empty-state")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add weigh-in/i }));

    expect(spy).toHaveBeenCalled();
    const evt = spy.mock.calls[0]![0] as CustomEvent;
    expect(evt.type).toBe("weights:add");
  });

  it("renders chart container when points exist", () => {
    // JSDOM can't reliably compute ResponsiveContainer sizes; chart primitives may not mount.
    const now = dayjs();
    const points = [{ datetime: now.toISOString(), weight_kg: 80 }];

    renderWithLocalization(<WeightChartCard points={points} />);

    expect(screen.getByRole("img", { name: /weight trend chart/i })).toBeInTheDocument();
  });
});
