import { Box, Card, CardContent, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { WeightPoint, movingAverage, sortByDatetimeAsc } from "../domain/trends";

type RangeKey = "7d" | "30d" | "90d";

function rangeDays(key: RangeKey) {
  if (key === "7d") return 7;
  if (key === "30d") return 30;
  return 90;
}

export function WeightChartCard({ points }: { points: WeightPoint[] }) {
  const [range, setRange] = useState<RangeKey>("30d");

  const data = useMemo(() => {
    const sorted = sortByDatetimeAsc(points);
    const end = dayjs();
    const start = end.subtract(rangeDays(range) - 1, "day").startOf("day");
    const window = sorted.filter((p) => dayjs(p.datetime).isAfter(start) || dayjs(p.datetime).isSame(start));
    return movingAverage(window, 7).map((p) => ({
      date: dayjs(p.datetime).format("MMM D"),
      weight: p.weight_kg,
      ma: p.ma,
    }));
  }, [points, range]);

  const min = data.length ? Math.min(...data.map((d) => d.weight)) : 0;
  const max = data.length ? Math.max(...data.map((d) => d.weight)) : 100;

  const summaryText = useMemo(() => {
    const last = data.at(-1);
    if (!last) return null;
    const w = last.weight;
    const ma = last.ma;
    const maText = ma !== null && ma !== undefined ? ` (7-pt avg ${ma.toFixed(1)} kg)` : "";
    return `${w.toFixed(1)} kg${maText}`;
  }, [data]);

  return (
    <Card variant="outlined">
      <CardContent>
        <StackedHeader title="Weight" summary={summaryText} />

        <ToggleButtonGroup
          size="small"
          value={range}
          exclusive
          onChange={(_, v) => v && setRange(v)}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="7d">7d</ToggleButton>
          <ToggleButton value="30d">30d</ToggleButton>
          <ToggleButton value="90d">90d</ToggleButton>
        </ToggleButtonGroup>

        {data.length === 0 ? (
          <Box
            sx={{
              height: 240,
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 2,
            }}
          >
            <Typography color="text.secondary" align="center">
              No weigh-ins in this range.
            </Typography>
          </Box>
        ) : (
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis
                  domain={[Math.floor(min - 1), Math.ceil(max + 1)]}
                  tick={{ fontSize: 12 }}
                  width={48}
                />
                <Tooltip />
                <Legend
                  verticalAlign="top"
                  height={24}
                  formatter={(v) => (v === "weight" ? "Weigh-in" : "7-pt avg")}
                />
                <Line type="monotone" dataKey="weight" name="weight" stroke="#90caf9" dot={{ r: 2 }} strokeWidth={2} />
                <Line type="monotone" dataKey="ma" name="ma" stroke="#a5d6a7" dot={false} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <Typography variant="caption" color="text.secondary">
          Moving average: trailing 7 points.
        </Typography>
      </CardContent>
    </Card>
  );
}

function StackedHeader({ title, summary }: { title: string; summary: string | null }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 1, gap: 2 }}>
      <Typography variant="h6">{title}</Typography>
      {summary ? (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
          {summary}
        </Typography>
      ) : null}
    </Box>
  );
}
