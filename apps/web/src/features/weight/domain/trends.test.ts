import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { computeChangeVsLastWeek, computeWindowAverage, movingAverage } from "./trends";

describe("weight trends", () => {
  it("computes 7d average over inclusive day window", () => {
    const end = dayjs("2026-02-10T12:00:00Z");
    const points = [
      { datetime: "2026-02-04T09:00:00Z", weight_kg: 80 },
      { datetime: "2026-02-05T09:00:00Z", weight_kg: 81 },
      { datetime: "2026-02-10T09:00:00Z", weight_kg: 79 },
      // outside window
      { datetime: "2026-02-03T09:00:00Z", weight_kg: 100 },
    ];

    const avg7 = computeWindowAverage(points, end, 7);
    expect(avg7).toBeCloseTo((80 + 81 + 79) / 3, 6);
  });

  it("computes change vs last week (7d avg - prev 7d avg)", () => {
    const end = dayjs("2026-02-15T12:00:00Z");
    const points = [
      // last week window ends at 2026-02-08
      { datetime: "2026-02-02T09:00:00Z", weight_kg: 82 },
      { datetime: "2026-02-08T09:00:00Z", weight_kg: 80 },
      // this week window ends at 2026-02-15
      { datetime: "2026-02-09T09:00:00Z", weight_kg: 79 },
      { datetime: "2026-02-15T09:00:00Z", weight_kg: 78 },
    ];

    const delta = computeChangeVsLastWeek(points, end);
    const lastWeekAvg = (82 + 80) / 2;
    const thisWeekAvg = (79 + 78) / 2;
    expect(delta).toBeCloseTo(thisWeekAvg - lastWeekAvg, 6);
  });

  it("moving average is trailing and returns nulls only if no data", () => {
    const points = [
      { datetime: "2026-02-01T00:00:00Z", weight_kg: 80 },
      { datetime: "2026-02-02T00:00:00Z", weight_kg: 81 },
      { datetime: "2026-02-03T00:00:00Z", weight_kg: 82 },
    ];
    const ma = movingAverage(points, 2);
    expect(ma.map((p) => p.ma)).toEqual([80, 80.5, 81.5]);
  });
});
