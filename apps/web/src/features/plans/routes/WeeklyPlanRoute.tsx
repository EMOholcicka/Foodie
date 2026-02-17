import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useGenerateWeeklyPlanMutation, useWeeklyPlanQuery } from "../api/plansQueries";
import {
  fmtDate,
  getWeekStartFromUrlOrStorage,
  mealTypeShort,
  persistLastWeekStart,
  startOfIsoWeek,
  weekLabel,
  weekdays,
} from "../domain/week";
import type { MealType, WeeklyPlanDay, WeeklyPlanGenerateRequest, WeeklyPlanMeal } from "../api/plansApi";

type TrainingDayType = "lift" | "run" | "rest";

type PlanTab = "plan" | "grocery";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function MacroLine({ kcal, p, c, f }: { kcal: number; p: number; c: number; f: number }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {Math.round(kcal)} kcal • P {p.toFixed(0)}g • C {c.toFixed(0)}g • F {f.toFixed(0)}g
    </Typography>
  );
}

function findDay(days: WeeklyPlanDay[] | undefined, date: string) {
  return (days ?? []).find((d) => d.date === date);
}

function PlanSubNav({ tab, weekStart }: { tab: PlanTab; weekStart: string }) {
  const navigate = useNavigate();

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={tab}
      onChange={(_, v) => {
        if (!v) return;
        navigate(v === "plan" ? `/plan?week=${encodeURIComponent(weekStart)}` : `/plan/grocery?week=${encodeURIComponent(weekStart)}`);
      }}
      aria-label="Plan section navigation"
      sx={{
        bgcolor: "background.paper",
        border: (t) => `1px solid ${t.palette.divider}`,
        borderRadius: 999,
        overflow: "hidden",
        "& .MuiToggleButton-root": {
          px: 1.5,
          "&:focus-visible": {
            outline: (t) => `2px solid ${t.palette.primary.main}`,
            outlineOffset: 2,
          },
        },
      }}
    >
      <ToggleButton value="plan" aria-label="Plan">
        Plan
      </ToggleButton>
      <ToggleButton value="grocery" aria-label="Grocery">
        Grocery
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

function TotalsLine({ totals }: { totals?: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null }) {
  if (!totals) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }

  return (
    <Typography variant="body2" color="text.secondary">
      {Math.round(totals.kcal)} kcal • P {totals.protein_g.toFixed(0)} • C {totals.carbs_g.toFixed(0)} • F {totals.fat_g.toFixed(0)}
    </Typography>
  );
}

export function WeeklyPlanRoute() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  const weekStart = useMemo(() => {
    return getWeekStartFromUrlOrStorage({ searchParams: sp, fallback: dayjs() });
  }, [sp]);

  useEffect(() => {
    persistLastWeekStart(weekStart);
  }, [weekStart]);

  const weekStartD = useMemo(() => dayjs(weekStart, "YYYY-MM-DD", true), [weekStart]);

  const planQuery = useWeeklyPlanQuery(weekStart);
  const genMutation = useGenerateWeeklyPlanMutation();

  const [targetKcal, setTargetKcal] = useState(2200);
  const [template, setTemplate] = useState<WeeklyPlanGenerateRequest["template"]>("recomp_2200");

  const [training, setTraining] = useState<Record<string, TrainingDayType>>({
    mon: "lift",
    tue: "rest",
    wed: "lift",
    thu: "run",
    fri: "lift",
    sat: "run",
    sun: "rest",
  });

  const [prefVeg, setPrefVeg] = useState(false);
  const [prefDairyFree, setPrefDairyFree] = useState(false);
  const [prefGlutenFree, setPrefGlutenFree] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapMeal, setSwapMeal] = useState<{ date: string; meal: WeeklyPlanMeal } | null>(null);

  const weekDays = useMemo(() => {
    return weekdays().map((i) => {
      const d = weekStartD.add(i, "day");
      return { date: fmtDate(d), label: d.format("ddd"), long: d.format("dddd"), short: d.format("D") };
    });
  }, [weekStartD]);

  const drawerDay = useMemo(() => {
    if (!activeDate) return null;
    return findDay(planQuery.data?.days, activeDate) ?? null;
  }, [activeDate, planQuery.data?.days]);

  function setWeek(nextWeekStart: string) {
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      n.set("week", nextWeekStart);
      return n;
    });
  }

  async function generate() {
    const payload: WeeklyPlanGenerateRequest = {
      week_start: weekStart,
      template,
      target_kcal: Number.isFinite(targetKcal) ? targetKcal : 2200,
      training_schedule: {
        mon: training.mon,
        tue: training.tue,
        wed: training.wed,
        thu: training.thu,
        fri: training.fri,
        sat: training.sat,
        sun: training.sun,
      },
      preferences: {
        vegetarian: prefVeg || undefined,
        dairy_free: prefDairyFree || undefined,
        gluten_free: prefGlutenFree || undefined,
      },
    };

    await genMutation.mutateAsync(payload);
  }

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Stack spacing={2}>
        {/* Compact header/toolbar */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              Weekly plan
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              Week of {weekLabel(weekStartD)}
            </Typography>
          </Stack>

          <PlanSubNav tab="plan" weekStart={weekStart} />
        </Stack>

        {/* Week controls */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 0.5,
          }}
        >
          <IconButton aria-label="Previous week" onClick={() => setWeek(fmtDate(weekStartD.subtract(7, "day")))}>
            <ChevronLeftIcon />
          </IconButton>

          <Stack alignItems="center" spacing={0.25} sx={{ flex: 1 }}>
            <Chip size="small" label={weekLabel(weekStartD)} />
            <Typography variant="caption" color="text.secondary">
              {weekStart}
            </Typography>
          </Stack>

          <IconButton aria-label="Next week" onClick={() => setWeek(fmtDate(weekStartD.add(7, "day")))}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        {/* Plan hero: overview grid */}
        {planQuery.isLoading ? <LinearProgress /> : null}

        {planQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => planQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Failed to load weekly plan.
          </Alert>
        ) : null}

        {planQuery.isSuccess && !planQuery.data ? <Alert severity="info">No plan yet. Generate one.</Alert> : null}

        {planQuery.data ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(7, 1fr)" },
              gap: 1,
            }}
          >
            {weekDays.map((d) => {
              const day = findDay(planQuery.data?.days, d.date);
              const totals = day?.totals;
              const isActive = d.date === activeDate;

              return (
                <ButtonBase
                  key={d.date}
                  aria-label={`Open ${d.long}`}
                  onClick={() => {
                    setActiveDate(d.date);
                    setDrawerOpen(true);
                  }}
                  sx={{
                    width: "100%",
                    textAlign: "left",
                    alignItems: "stretch",
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    boxShadow: (t) => (isActive ? `0 0 0 2px ${t.palette.primary.main}` : `0 0 0 1px ${t.palette.divider}`),
                    transition: "box-shadow 120ms ease",
                    "&:hover": {
                      boxShadow: (t) => `0 0 0 2px ${t.palette.action.selected}`,
                    },
                    "&:focus-visible": {
                      boxShadow: (t) => `0 0 0 2px ${t.palette.primary.main}`,
                    },
                  }}
                >
                  <Box sx={{ p: 1.5, width: "100%" }}>
                    <Stack spacing={0.75}>
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                        <Typography variant="subtitle2">{d.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.short}
                        </Typography>
                      </Stack>

                      <TotalsLine totals={totals} />

                      <Typography variant="caption" color="text.secondary">
                        Tap to view meals
                      </Typography>
                    </Stack>
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>
        ) : null}

        {/* Generate panel: demoted into compact utility card */}
        <Box
          sx={{
            border: (t) => `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            p: 1.5,
            bgcolor: "background.paper",
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Typography variant="subtitle2">Generator</Typography>
              <Button variant="contained" onClick={() => void generate()} disabled={genMutation.isPending} size="small">
                Generate
              </Button>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel id="template-label">Template</InputLabel>
                <Select<WeeklyPlanGenerateRequest["template"]>
                  labelId="template-label"
                  value={template}
                  label="Template"
                  onChange={(e) => setTemplate(e.target.value as WeeklyPlanGenerateRequest["template"])}
                >
                  <MenuItem value="recomp_2200">2200 recomposition</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                size="small"
                label="Target kcal"
                type="number"
                value={targetKcal}
                onChange={(e) => setTargetKcal(Number(e.target.value))}
              />
            </Stack>

            <Box>
              <FormLabel component="legend">Training schedule</FormLabel>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  mt: 1,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  // prevent overlap when the row wraps (MUI's `spacing` only sets gaps for the primary axis)
                  rowGap: 1,
                  columnGap: 1,
                }}
              >
                {(
                  [
                    ["mon", "Mon"],
                    ["tue", "Tue"],
                    ["wed", "Wed"],
                    ["thu", "Thu"],
                    ["fri", "Fri"],
                    ["sat", "Sat"],
                    ["sun", "Sun"],
                  ] as const
                ).map(([k, label]) => (
                  <FormControl key={k} size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id={`${k}-label`}>{label}</InputLabel>
                    <Select
                      labelId={`${k}-label`}
                      label={label}
                      value={training[k]}
                      onChange={(e) => setTraining((p) => ({ ...p, [k]: e.target.value as TrainingDayType }))}
                    >
                      <MenuItem value="lift">Lift</MenuItem>
                      <MenuItem value="run">Run</MenuItem>
                      <MenuItem value="rest">Rest</MenuItem>
                    </Select>
                  </FormControl>
                ))}
              </Stack>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <FormControlLabel
                control={<Switch checked={prefVeg} onChange={(e) => setPrefVeg(e.target.checked)} />}
                label={<Typography variant="body2">Vegetarian</Typography>}
              />
              <FormControlLabel
                control={<Switch checked={prefDairyFree} onChange={(e) => setPrefDairyFree(e.target.checked)} />}
                label={<Typography variant="body2">Dairy-free</Typography>}
              />
              <FormControlLabel
                control={<Switch checked={prefGlutenFree} onChange={(e) => setPrefGlutenFree(e.target.checked)} />}
                label={<Typography variant="body2">Gluten-free</Typography>}
              />
            </Stack>

            {genMutation.isPending ? <LinearProgress /> : null}
            {genMutation.isError ? <Alert severity="error">Failed to generate plan.</Alert> : null}

            <Divider />
            <Typography variant="caption" color="text.secondary">
              Swap/Lock controls are coming soon and will appear here once they persist server-side.
            </Typography>
          </Stack>
        </Box>
      </Stack>

      {/* Day detail drawer */}
      <Drawer anchor="bottom" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Container maxWidth="md" sx={{ py: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h6">{drawerDay ? dayjs(drawerDay.date).format("dddd, D MMM") : "Day"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {drawerDay?.date ?? ""}
                </Typography>
              </Box>
              <Button onClick={() => setDrawerOpen(false)}>Close</Button>
            </Stack>

            {drawerDay ? (
              <MacroLine
                kcal={drawerDay.totals.kcal}
                p={drawerDay.totals.protein_g}
                c={drawerDay.totals.carbs_g}
                f={drawerDay.totals.fat_g}
              />
            ) : null}

            <Stack spacing={1}>
              {(drawerDay?.meals ?? [])
                .slice()
                .sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type))
                .map((m) => (
                  <Box
                    key={m.id}
                    sx={{
                      border: (t) => `1px solid ${t.palette.divider}`,
                      borderRadius: 2,
                      p: 1.5,
                      bgcolor: "background.paper",
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>
                          {m.meal_type}
                        </Typography>
                        <Typography variant="body2" noWrap title={m.recipe_name ?? ""}>
                          {m.recipe_name ?? "—"}
                        </Typography>
                        <MacroLine kcal={m.totals.kcal} p={m.totals.protein_g} c={m.totals.carbs_g} f={m.totals.fat_g} />
                      </Box>
                      <Chip size="small" label="Coming soon" variant="outlined" />
                    </Stack>
                  </Box>
                ))}
            </Stack>

            <Button
              variant="outlined"
              startIcon={<LocalGroceryStoreIcon />}
              onClick={() => navigate(`/plan/grocery?week=${encodeURIComponent(weekStart)}`)}
            >
              Open grocery list
            </Button>
          </Stack>
        </Container>
      </Drawer>

      {/* Swap dialog (recipe selector placeholder) */}
      <Dialog open={swapOpen} onClose={() => setSwapOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Swap meal</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="info">
              Recipe selector UI is stubbed in Phase 7 frontend. Hook your existing recipe list/search component here.
            </Alert>
            <Box
              sx={{
                border: (t) => `1px solid ${t.palette.divider}`,
                borderRadius: 2,
                p: 2,
              }}
            >
              <Typography variant="subtitle2">Selected</Typography>
              <Typography variant="body2">{swapMeal ? `${swapMeal.date} • ${swapMeal.meal.meal_type}` : "—"}</Typography>
              <Typography variant="body2" color="text.secondary">
                {swapMeal?.meal.recipe_name ?? "—"}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<ContentCopyIcon />}
              onClick={() => {
                // Placeholder action
                setSwapOpen(false);
              }}
            >
              Pick recipe (placeholder)
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
