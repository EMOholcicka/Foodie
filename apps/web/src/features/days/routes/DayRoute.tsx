import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { addDayEntries, dayQueryKeys, getDay, type MealType } from "../api/daysApi";
import { MealSectionCard } from "../components/MealSectionCard";
import { FoodDetailDrawer } from "../../foods/components/FoodDetailDrawer";
import { FoodSearchPanel } from "../../foods/components/FoodSearchPanel";
import type { Food } from "../../foods/api/foodsApi";
import { CreateFoodDialog } from "../../foods/components/CreateFoodDialog";
import { RemainingTargetsCard } from "../../targets/components/RemainingTargetsCard";

function fmt(d: dayjs.Dayjs) {
  return d.format("YYYY-MM-DD");
}

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function isMealType(v: string | null): v is MealType {
  return v === "breakfast" || v === "lunch" || v === "dinner" || v === "snack";
}

export function DayRoute() {
  const params = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();

  const today = useMemo(() => fmt(dayjs()), []);

  const dateParam = params.date;
  const date = dateParam ?? today;

  const parsed = useMemo(() => dayjs(date, "YYYY-MM-DD", true), [date]);
  const isValidDate = parsed.isValid();

  useEffect(() => {
    if (!dateParam) return;
    if (!isValidDate) navigate(`/day/${today}`, { replace: true });
  }, [dateParam, isValidDate, navigate, today]);

  const dayQuery = useQuery({
    queryKey: dayQueryKeys.byDate(date),
    queryFn: () => getDay(date),
    enabled: isValidDate,
  });

  const addMutation = useMutation({
    mutationFn: (args: { mealType: MealType; foodId: string; grams: number }) =>
      addDayEntries(date, [{ meal_type: args.mealType, food_id: args.foodId, grams: args.grams }]),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: dayQueryKeys.byDate(date) });
    },
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealType>("breakfast");
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitial, setCreateInitial] = useState<string | undefined>(undefined);

  const [addErrorOpen, setAddErrorOpen] = useState(false);

  function closePicker() {
    setPickerOpen(false);
    setDetailOpen(false);
    setSelectedFood(null);
    setCreateOpen(false);
    setCreateInitial(undefined);
  }

  const mealParam = sp.get("meal");

  useEffect(() => {
    const meal = mealParam;
    if (!meal) return;
    if (!isMealType(meal)) {
      setSp(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("meal");
          return n;
        },
        { replace: true }
      );
      return;
    }

    setActiveMeal(meal);
    setPickerOpen(true);
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("meal");
        return n;
      },
      { replace: true }
    );
  }, [mealParam, setSp]);

  const day = dayQuery.data;

  if (!isValidDate) {
    return (
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Alert severity="warning" action={<Button onClick={() => navigate(`/day/${today}`)}>Go to today</Button>}>
          Invalid date.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <IconButton aria-label="Previous day" onClick={() => navigate(`/day/${fmt(parsed.subtract(1, "day"))}`)}>
            <ChevronLeftIcon />
          </IconButton>

          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h6" component="h1">
              {parsed.format("ddd, D MMM")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {date}
            </Typography>
          </Box>

          <IconButton aria-label="Next day" onClick={() => navigate(`/day/${fmt(parsed.add(1, "day"))}`)}>
            <ChevronRightIcon />
          </IconButton>
        </Stack>

        <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
          <Button
            size="small"
            variant={date === today ? "contained" : "outlined"}
            onClick={() => navigate(`/day/${today}`)}
            aria-label="Jump to today"
          >
            Today
          </Button>
          <Select
            size="small"
            value={date}
            onChange={(e) => navigate(`/day/${e.target.value}`)}
            aria-label="Select date"
            sx={{ width: "fit-content", minWidth: 160 }}
          >
            {Array.from({ length: 75 }).map((_, idx) => {
              const shift = idx - 14; // include some future days
              const d = dayjs().add(shift, "day");
              const v = fmt(d);
              const label = d.format("ddd, D MMM");
              if (shift === 0) return null; // avoid redundancy: Today shortcut button already exists
              return (
                <MenuItem key={v} value={v}>
                  {shift > 0 ? `${label} (in ${shift}d)` : label}
                </MenuItem>
              );
            })}
          </Select>
        </Stack>

        {dayQuery.isLoading ? <LinearProgress /> : null}

        {dayQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => dayQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Failed to load day.
          </Alert>
        ) : null}

        {dayQuery.isSuccess && (day?.meals?.length ?? 0) === 0 ? <Alert severity="info">No meals yet. Add your first food.</Alert> : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Day totals
            </Typography>
            <Typography variant="body1">
              {day ? `${Math.round(day.totals.kcal)} kcal` : "—"} • P {day ? day.totals.protein_g.toFixed(1) : "—"}g • C{" "}
              {day ? day.totals.carbs_g.toFixed(1) : "—"}g • F {day ? day.totals.fat_g.toFixed(1) : "—"}g
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <RemainingTargetsCard totals={day?.totals} dense />
          </Box>
        </Stack>

        <Stack spacing={2}>
          {(day?.meals ?? [])
            .slice()
            .sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type))
            .map((m) => (
              <MealSectionCard
                key={m.meal_type}
                meal={m}
                onAddEntry={() => {
                  setActiveMeal(m.meal_type);
                  setPickerOpen(true);
                }}
              />
            ))}
        </Stack>

        <Button
          variant="contained"
          onClick={() => {
            setActiveMeal("breakfast");
            setPickerOpen(true);
          }}
          disabled={dayQuery.isLoading || dayQuery.isError}
        >
          Add food
        </Button>
      </Stack>

      <Dialog
        open={pickerOpen}
        onClose={(_, reason) => {
          if (addMutation.isPending && (reason === "backdropClick" || reason === "escapeKeyDown")) return;
          closePicker();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Add to {activeMeal}</DialogTitle>
        <DialogContent>
          <FoodSearchPanel
            mealType={activeMeal}
            showQuickAddFeedback={false}
            onPickFood={(f) => {
              setSelectedFood(f);
              setDetailOpen(true);
            }}
            onQuickAdd={async (args) => {
              try {
                await addMutation.mutateAsync(args);
                closePicker();
              } catch {
                setAddErrorOpen(true);
              }
            }}
            onCreateFood={(initial) => {
              setCreateInitial(initial);
              setCreateOpen(true);
            }}
          />
        </DialogContent>
      </Dialog>

      <FoodDetailDrawer
        open={detailOpen}
        food={selectedFood}
        mealType={activeMeal}
        pending={addMutation.isPending}
        onClose={() => {
          if (addMutation.isPending) return;
          setDetailOpen(false);
        }}
        onAdd={async ({ foodId, grams, mealType }) => {
          try {
            await addMutation.mutateAsync({ foodId, grams, mealType });
            closePicker();
          } catch {
            setAddErrorOpen(true);
          }
        }}
      />

      <CreateFoodDialog
        open={createOpen}
        initialName={createInitial}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["foods"] });
        }}
      />

      <Snackbar
        open={addErrorOpen}
        autoHideDuration={4000}
        onClose={() => setAddErrorOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setAddErrorOpen(false)}>
          Failed to add entry. Please try again.
        </Alert>
      </Snackbar>
    </Container>
  );
}
