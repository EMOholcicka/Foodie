import { Alert, Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import type { AxiosError } from "axios";

import type { MacroTotals } from "../../days/api/daysApi";
import { useTargetsQuery } from "../api/targetsQueries";

type Props = {
  totals: MacroTotals | undefined;
  dense?: boolean;
};

function fmtG(value: number) {
  return `${Math.round(value)}g`;
}

function remainingLabel(value: number): "Remaining" | "Over by" {
  return value < 0 ? "Over by" : "Remaining";
}

function remainingColor(value: number): "error.main" | "text.primary" {
  return value < 0 ? "error.main" : "text.primary";
}

function absRounded(value: number): number {
  return Math.round(Math.abs(value));
}

export function RemainingTargetsCard(props: Props) {
  const q = useTargetsQuery();

  if (q.isLoading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Remaining
            </Typography>
            <LinearProgress aria-label="Loading targets for remaining" />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (q.isError) {
    const status = (q.error as AxiosError | undefined)?.response?.status;

    // Targets are not set yet (API returns 404) -> show empty state CTA.
    if (status === 404) {
      return (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Remaining
              </Typography>
              <Alert severity="info" action={<Button size="small" href="/targets">Set targets</Button>}>
                Set targets to see remaining.
              </Alert>
            </Stack>
          </CardContent>
        </Card>
      );
    }

    // Any other error -> real error state with retry.
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Remaining
            </Typography>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => q.refetch()}>
                  Retry
                </Button>
              }
            >
              Failed to load targets.
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const targets = q.data;
  const totals = props.totals;

  const consumedKcal = totals ? totals.kcal : 0;
  const remainingKcalRaw = targets.kcal_target - consumedKcal;

  const hasMacroTargets = targets.protein_g > 0 || targets.carbs_g > 0 || targets.fat_g > 0;

  const remainingPRaw = targets.protein_g - (totals?.protein_g ?? 0);
  const remainingCRaw = targets.carbs_g - (totals?.carbs_g ?? 0);
  const remainingFRaw = targets.fat_g - (totals?.fat_g ?? 0);

  const remainingP = Math.round(remainingPRaw * 10) / 10;
  const remainingC = Math.round(remainingCRaw * 10) / 10;
  const remainingF = Math.round(remainingFRaw * 10) / 10;

  const isOver = remainingKcalRaw < 0 || remainingPRaw < 0 || remainingCRaw < 0 || remainingFRaw < 0;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" color={isOver ? "error.main" : "text.secondary"}>
          {remainingLabel(remainingKcalRaw)}
        </Typography>

        <Typography
          variant={props.dense ? "h5" : "h4"}
          sx={{ mt: 0.5, color: remainingColor(remainingKcalRaw) }}
          aria-label={remainingKcalRaw < 0 ? "Over by kcal" : "Remaining kcal"}
        >
          {absRounded(remainingKcalRaw)} kcal
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Consumed: {Math.round(consumedKcal)} kcal • Target: {targets.kcal_target} kcal
        </Typography>

        {hasMacroTargets ? (
          <Box sx={{ mt: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Typography
                variant="body2"
                sx={{ color: remainingColor(remainingPRaw) }}
                aria-label={remainingPRaw < 0 ? "Over by protein" : "Remaining protein"}
              >
                P {remainingLabel(remainingPRaw)} {fmtG(Math.abs(remainingP))}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: remainingColor(remainingCRaw) }}
                aria-label={remainingCRaw < 0 ? "Over by carbs" : "Remaining carbs"}
              >
                C {remainingLabel(remainingCRaw)} {fmtG(Math.abs(remainingC))}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: remainingColor(remainingFRaw) }}
                aria-label={remainingFRaw < 0 ? "Over by fat" : "Remaining fat"}
              >
                F {remainingLabel(remainingFRaw)} {fmtG(Math.abs(remainingF))}
              </Typography>
            </Stack>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
