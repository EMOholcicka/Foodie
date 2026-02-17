import { Box, Button, Card, CardContent, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
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

  const windowed = useMemo(() => {
    const sorted = sortByDatetimeAsc(points);
    const end = dayjs();
    const start = end.subtract(rangeDays(range) - 1, "day").startOf("day");
    return sorted.filter((p) => dayjs(p.datetime).isAfter(start) || dayjs(p.datetime).isSame(start));
  }, [points, range]);

  const data = useMemo(() => {
    return movingAverage(windowed, 7).map((p) => ({
      date: dayjs(p.datetime).format("MMM D"),
      weight: p.weight_kg,
      ma: p.ma,
    }));
  }, [windowed]);

  const min = data.length ? Math.min(...data.map((d) => d.weight)) : 0;
  const max = data.length ? Math.max(...data.map((d) => d.weight)) : 100;

  const summaryText = useMemo(() => {
    const first = data.at(0);
    const last = data.at(-1);
    if (!first || !last) return null;

    const delta = last.weight - first.weight;
    const deltaText = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg`;

    const maText = last.ma !== null && last.ma !== undefined ? ` (7-pt avg ${last.ma.toFixed(1)} kg)` : "";

    return `Last ${rangeDays(range)}d: ${first.weight.toFixed(1)} → ${last.weight.toFixed(1)} kg (${deltaText})${maText}`;
  }, [data, range]);

  return (
    <Card variant="outlined">
      <CardContent>
        <StackedHeader title="Weight" summary={summaryText} />

        {summaryText ? (
          <Typography id="weight-chart-summary" variant="srOnly">
            {summaryText}
          </Typography>
        ) : null}

        <ToggleButtonGroup
          size="small"
          value={range}
          exclusive
          onChange={(_, v) => v && setRange(v)}
          sx={{ mb: 2 }}
          aria-label="Weight chart range"
        >
          <ToggleButton value="7d" aria-label="Last 7 days">
            7d
          </ToggleButton>
          <ToggleButton value="30d" aria-label="Last 30 days">
            30d
          </ToggleButton>
          <ToggleButton value="90d" aria-label="Last 90 days">
            90d
          </ToggleButton>
        </ToggleButtonGroup>

        {data.length === 0 ? (
          <Box
            sx={{
              height: 240,
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              px: 2,
              gap: 1,
            }}
          >
            <Typography color="text.secondary" align="center">
              No weigh-ins in this range.
            </Typography>
            <Button variant="contained" size="small" onClick={() => document.dispatchEvent(new CustomEvent("weights:add"))}>
              Add weigh-in
            </Button>
          </Box>
        ) : (
          <div
            style={{ width: "100%", height: 240 }}
            role="img"
            aria-label="Weight trend chart"
            aria-describedby={summaryText ? "weight-chart-summary" : undefined}
          >
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis domain={[Math.floor(min - 1), Math.ceil(max + 1)]} tick={{ fontSize: 12 }} width={48} />
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
