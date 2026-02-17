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
import { MealTypeIcon, TodayEmptyMealsIllustration } from "../../../shared/graphics";

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

  const mealsAllZero =
    dayQuery.isSuccess &&
    meals.length > 0 &&
    meals.every((m) => Math.round(m.totals.kcal) === 0);

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

            {dayQuery.isSuccess && (meals.length === 0 || mealsAllZero) ? (
              <Box
                sx={(t) => ({
                  mt: 1,
                  p: 1.25,
                  borderRadius: 2,
                  border: `1px solid ${t.palette.divider}`,
                  bgcolor: "background.paper",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "220px 1fr" },
                  gap: 1.25,
                  alignItems: "center",
                })}
              >
                <Box aria-hidden sx={{ opacity: 0.95 }}>
                  <TodayEmptyMealsIllustration className="foodie-illustration" />
                </Box>
                <Box>
                  <Typography variant="subtitle2">Nothing logged yet</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    Add your first meal to see calories and macros update here.
                  </Typography>
                </Box>
              </Box>
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
                  <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      aria-hidden
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        color: "rgba(255,255,255,0.92)",
                        bgcolor: "rgba(255,255,255,0.04)",
                        border: (t) => `1px solid ${t.palette.divider}`,
                        flex: "0 0 auto",
                      }}
                    >
                      <MealTypeIcon type={m.meal_type} className="foodie-meal-icon" />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ textTransform: "capitalize" }} noWrap>
                        {m.meal_type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {Math.round(m.totals.kcal)} kcal
                      </Typography>
                    </Box>
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
