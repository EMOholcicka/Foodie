import { Card, CardContent, Grid, Typography } from "@mui/material";
import dayjs from "dayjs";

import { WeightPoint, computeChangeVsLastWeek, computeWindowAverage } from "../domain/trends";

function fmtKg(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)} kg`;
}

function fmtDeltaKg(value: number | null) {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} kg`;
}

export function TrendSummaryCard({ points }: { points: WeightPoint[] }) {
  const end = dayjs();
  const avg7 = computeWindowAverage(points, end, 7);
  const avg14 = computeWindowAverage(points, end, 14);
  const delta = computeChangeVsLastWeek(points, end);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Trend summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">
              7-day avg
            </Typography>
            <Typography variant="h6">{fmtKg(avg7)}</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">
              14-day avg
            </Typography>
            <Typography variant="h6">{fmtKg(avg14)}</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">
              vs last week
            </Typography>
            <Typography variant="h6" color={delta === null ? undefined : delta <= 0 ? "success.main" : "warning.main"}>
              {fmtDeltaKg(delta)}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
