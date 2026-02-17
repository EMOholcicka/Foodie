import { Alert, Button, Card, CardContent, Container, LinearProgress, Skeleton, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { dayQueryKeys, getDay } from "../api/daysApi";
import { RemainingTargetsCard } from "../../targets/components/RemainingTargetsCard";

export function TodayRoute() {
  const navigate = useNavigate();
  const today = dayjs().format("YYYY-MM-DD");
  const dayQuery = useQuery({
    queryKey: dayQueryKeys.byDate(today),
    queryFn: () => getDay(today),
  });

  const totals = dayQuery.data?.totals;
  const meals = dayQuery.data?.meals ?? [];

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h5">Today</Typography>

        {dayQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => dayQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Failed to load today.
          </Alert>
        ) : null}

        {dayQuery.isLoading ? (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Remaining
              </Typography>
              <Skeleton variant="text" width={120} height={44} sx={{ mt: 0.5 }} />
              <Skeleton variant="text" width={260} sx={{ mt: 0.5 }} />
            </CardContent>
          </Card>
        ) : (
          <RemainingTargetsCard totals={totals} />
        )}

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">
              Meals
            </Typography>

            {dayQuery.isLoading ? <LinearProgress sx={{ mt: 1 }} /> : null}

            {dayQuery.isSuccess && meals.length === 0 ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                No meals yet.
              </Alert>
            ) : null}

            <Stack spacing={1} sx={{ mt: 1 }}>
              {meals.map((m) => (
                <Stack key={m.meal_type} direction="row" justifyContent="space-between">
                  <Typography sx={{ textTransform: "capitalize" }}>{m.meal_type}</Typography>
                  <Typography color="text.secondary">{Math.round(m.totals.kcal)} kcal</Typography>
                </Stack>
              ))}
            </Stack>

            <Button sx={{ mt: 2 }} fullWidth variant="contained" onClick={() => navigate(`/day/${today}`)}>
              Open day
            </Button>
          </CardContent>
        </Card>

        <Button variant="outlined" onClick={() => navigate(`/day/${today}`)}>
          Add food
        </Button>
      </Stack>
    </Container>
  );
}
