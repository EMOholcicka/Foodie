import dayjs from "dayjs";

export type WeightPoint = {
  datetime: string; // ISO
  weight_kg: number;
};

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

export function computeWindowAverage(points: WeightPoint[], endInclusive: dayjs.Dayjs, days: number): number | null {
  const start = endInclusive.subtract(days - 1, "day").startOf("day");
  const end = endInclusive.endOf("day");
  const window = points.filter((p) => {
    const d = dayjs(p.datetime);
    return (d.isAfter(start) || d.isSame(start)) && (d.isBefore(end) || d.isSame(end));
  });
  return average(window.map((p) => p.weight_kg));
}

export function computeChangeVsLastWeek(points: WeightPoint[], endInclusive: dayjs.Dayjs): number | null {
  const thisWeek = computeWindowAverage(points, endInclusive, 7);
  const lastWeek = computeWindowAverage(points, endInclusive.subtract(7, "day"), 7);
  if (thisWeek === null || lastWeek === null) return null;
  return thisWeek - lastWeek;
}

export function movingAverage(points: WeightPoint[], windowSize: number): Array<WeightPoint & { ma: number | null }> {
  if (windowSize <= 1) return points.map((p) => ({ ...p, ma: p.weight_kg }));
  const out: Array<WeightPoint & { ma: number | null }> = [];
  for (let i = 0; i < points.length; i++) {
    const startIdx = Math.max(0, i - windowSize + 1);
    const slice = points.slice(startIdx, i + 1);
    out.push({
      ...points[i]!,
      ma: average(slice.map((p) => p.weight_kg)),
    });
  }
  return out;
}

export function sortByDatetimeAsc(points: WeightPoint[]): WeightPoint[] {
  return [...points].sort((a, b) => dayjs(a.datetime).valueOf() - dayjs(b.datetime).valueOf());
}
