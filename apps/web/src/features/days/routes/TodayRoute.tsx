import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Fab,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { dayQueryKeys, getDay, type MealType } from "../api/daysApi";
import { RemainingTargetsCard } from "../../targets/components/RemainingTargetsCard";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function defaultMealByTime(now: dayjs.Dayjs): MealType {
  const h = now.hour();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 20) return "dinner";
  return "snack";
}

export function TodayRoute() {
  const navigate = useNavigate();
  const now = dayjs();
  const today = now.format("YYYY-MM-DD");
  const dayQuery = useQuery({
    queryKey: dayQueryKeys.byDate(today),
    queryFn: () => getDay(today),
  });

  const totals = dayQuery.data?.totals;
  const meals = (dayQuery.data?.meals ?? []).slice().sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type));

  const defaultMeal = defaultMealByTime(now);

  return (
    <Container maxWidth="md" sx={{ py: 2, pb: 10 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h1">
          Today
        </Typography>

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
                <Box
                  key={m.meal_type}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    border: (t) => `1px solid ${t.palette.divider}`,
                    borderRadius: 2,
                    px: 1,
                    py: 0.75,
                    bgcolor: "background.paper",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ textTransform: "capitalize" }} noWrap>
                      {m.meal_type}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {Math.round(m.totals.kcal)} kcal
                    </Typography>
                  </Box>

                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => navigate(`/day/${today}?meal=${encodeURIComponent(m.meal_type)}`)}
                    aria-label={`Add to ${m.meal_type}`}
                  >
                    Add
                  </Button>
                </Box>
              ))}
            </Stack>

            <Button sx={{ mt: 2 }} fullWidth variant="outlined" onClick={() => navigate(`/day/${today}`)}>
              Open day
            </Button>
          </CardContent>
        </Card>
      </Stack>

      <Fab
        color="primary"
        variant="extended"
        aria-label="Add food"
        onClick={() => navigate(`/day/${today}?meal=${encodeURIComponent(defaultMeal)}`)}
        sx={{ position: "fixed", right: 16, bottom: 88 }}
      >
        <AddIcon sx={{ mr: 1 }} /> Add food
      </Fab>
    </Container>
  );
}
