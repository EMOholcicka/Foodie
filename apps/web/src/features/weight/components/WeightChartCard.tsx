import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { WeightPoint, movingAverage, sortByDatetimeAsc } from "../domain/trends";

type RangeKey = "7d" | "30d" | "90d";

type ChartDatum = {
  date: string;
  datetime: string;
  weight: number;
  ma: number | null;
};

function rangeDays(key: RangeKey) {
  if (key === "7d") return 7;
  if (key === "30d") return 30;
  return 90;
}

function domainPadding(min: number, max: number) {
  const span = Math.max(0.6, (max - min) * 0.15);
  return {
    min: Math.floor((min - span) * 2) / 2,
    max: Math.ceil((max + span) * 2) / 2,
  };
}

function tickIntervalForRange(range: RangeKey, len: number) {
  if (len <= 2) return "preserveStartEnd" as const;
  if (range === "90d") {
    // Keep 90d readable: ~8-10 ticks on typical card widths.
    // interval=N means show every N+1.
    return Math.max(2, Math.ceil(len / 10) - 1);
  }
  return "preserveStartEnd" as const;
}

function formatTooltipDate(iso: string) {
  return dayjs(iso).format("ddd, MMM D");
}

function LegendDot({ sx }: { sx: Record<string, unknown> }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: "inline-block",
        width: 18,
        height: 0,
        borderTop: "3px solid",
        borderColor: "currentColor",
        borderRadius: 999,
        ...sx,
      }}
    />
  );
}

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: unknown; payload?: ChartDatum }>;
  label?: unknown;
}) {
  const theme = useTheme();

  if (!active || !payload?.length) return null;

  const base = payload[0]?.payload;
  const weight = payload.find((p) => p.dataKey === "weight")?.value;
  const ma = payload.find((p) => p.dataKey === "ma")?.value;

  return (
    <Box
      role="tooltip"
      sx={{
        px: 1.25,
        py: 1,
        borderRadius: 1.5,
        bgcolor: theme.palette.grey[900],
        color: theme.palette.common.white,
        border: "1px solid",
        borderColor: "rgba(255,255,255,0.12)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        minWidth: 160,
      }}
    >
      <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.72)" }}>
        {base?.datetime ? formatTooltipDate(base.datetime) : typeof label === "string" ? label : ""}
      </Typography>
      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.88)" }}>
            Weigh-in
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {typeof weight === "number" ? `${weight.toFixed(1)} kg` : "—"}
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.72)" }}>
            7-pt avg
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.88)" }}>
            {typeof ma === "number" ? `${ma.toFixed(1)} kg` : "—"}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

export function WeightChartCard({ points }: { points: WeightPoint[] }) {
  const theme = useTheme();
  const [range, setRange] = useState<RangeKey>("30d");

  const windowed = useMemo(() => {
    const sorted = sortByDatetimeAsc(points);
    const end = dayjs();
    const start = end.subtract(rangeDays(range) - 1, "day").startOf("day");
    return sorted.filter((p) => dayjs(p.datetime).isAfter(start) || dayjs(p.datetime).isSame(start));
  }, [points, range]);

  const data: ChartDatum[] = useMemo(() => {
    return movingAverage(windowed, 7).map((p) => ({
      date: dayjs(p.datetime).format("MMM D"),
      datetime: p.datetime,
      weight: p.weight_kg,
      ma: p.ma,
    }));
  }, [windowed]);

  const min = data.length ? Math.min(...data.map((d) => d.weight)) : 0;
  const max = data.length ? Math.max(...data.map((d) => d.weight)) : 100;
  const padded = domainPadding(min, max);

  const summaryText = useMemo(() => {
    const first = data.at(0);
    const last = data.at(-1);
    if (!first || !last) return null;

    const delta = last.weight - first.weight;
    const deltaText = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg`;

    const maText = last.ma !== null && last.ma !== undefined ? ` (7-pt avg ${last.ma.toFixed(1)} kg)` : "";

    return `Last ${rangeDays(range)}d: ${first.weight.toFixed(1)} → ${last.weight.toFixed(1)} kg (${deltaText})${maText}`;
  }, [data, range]);

  const rangeControl = (
    <ToggleButtonGroup
      size="small"
      value={range}
      exclusive
      onChange={(_, v) => v && setRange(v)}
      aria-label="Weight chart range"
      sx={{
        bgcolor: "background.paper",
        borderRadius: 2,
        "& .MuiToggleButton-root": {
          px: 1.25,
          textTransform: "none",
        },
      }}
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
  );

  return (
    <Card variant="outlined">
      <CardContent>
        {/* Title row */}
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6">Weight</Typography>
          {summaryText ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                flex: "1 1 220px",
                textAlign: { xs: "left", sm: "right" },
              }}
            >
              {summaryText}
            </Typography>
          ) : null}
        </Box>

        {/* Tools row */}
        <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Range
          </Typography>
          {rangeControl}
        </Box>

        {/* Tiny legend (non-color differentiator via line style) */}
        <Box
          aria-label="Weight chart legend"
          sx={{
            mt: 1,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            color: "text.secondary",
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ color: theme.palette.primary.light }}>
              <LegendDot sx={{ borderTopStyle: "solid" }} />
            </Box>
            <Typography variant="caption">Weigh-ins</Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ color: theme.palette.success.light }}>
              <LegendDot sx={{ borderTopStyle: "dashed" }} />
            </Box>
            <Typography variant="caption">7-pt avg</Typography>
          </Stack>
        </Box>

        <Divider sx={{ mt: 1.5, mb: 1.5 }} />

        {summaryText ? (
          <Typography id="weight-chart-summary" variant="srOnly">
            {summaryText}
          </Typography>
        ) : null}

        {/* Chart area */}
        {data.length === 0 ? (
          <Box
            data-testid="weight-empty-state"
            sx={{
              height: 240,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              px: 2.5,
              gap: 0.75,
            }}
          >
            <Typography variant="subtitle2">No weigh-ins yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Add a weigh-in to start tracking your trend.
            </Typography>
            <Box sx={{ mt: 0.75 }}>
              <Button
                variant="contained"
                size="small"
                onClick={() => document.dispatchEvent(new CustomEvent("weights:add"))}
              >
                Add weigh-in
              </Button>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{ width: "100%", height: 240 }}
            role="img"
            aria-label="Weight trend chart"
            aria-describedby={summaryText ? "weight-chart-summary" : undefined}
          >
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" opacity={0.35} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                  interval={tickIntervalForRange(range, data.length)}
                  tickMargin={8}
                  axisLine={{ stroke: theme.palette.divider, opacity: 0.8 }}
                  tickLine={{ stroke: theme.palette.divider, opacity: 0.6 }}
                />
                <YAxis
                  domain={[padded.min, padded.max]}
                  tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                  width={44}
                  tickMargin={8}
                  axisLine={{ stroke: theme.palette.divider, opacity: 0.8 }}
                  tickLine={{ stroke: theme.palette.divider, opacity: 0.6 }}
                  unit=" kg"
                />
                <Tooltip content={<TooltipContent />} wrapperStyle={{ outline: "none" }} />

                {/* Series */}
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="weight"
                  stroke={theme.palette.primary.light}
                  dot={{ r: 2.5, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  strokeWidth={2.25}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ma"
                  name="ma"
                  stroke={theme.palette.success.light}
                  dot={false}
                  strokeWidth={3}
                  strokeOpacity={0.9}
                  strokeDasharray="6 4"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Footer */}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
          Moving average: trailing 7 points.
        </Typography>
      </CardContent>
    </Card>
  );
}
