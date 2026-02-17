import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Chip,
  Container,
  Dialog,
  DialogActions,
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
  Snackbar,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  useGenerateWeeklyPlanMutation,
  useSetWeeklyPlanMealLockMutation,
  useSwapWeeklyPlanMealMutation,
  useWeeklyPlanQuery,
} from "../api/plansQueries";
import {
  fmtDate,
  getWeekStartFromUrlOrStorage,
  persistLastWeekStart,
  weekLabel,
  weekdays,
} from "../domain/week";
import type { MealType, SwapWeeklyPlanMealRequest, WeeklyPlanDay, WeeklyPlanGenerateRequest, WeeklyPlanMeal } from "../api/plansApi";
import { useRecipesListQuery } from "../../recipes/api/recipesQueries";
import { isApiError } from "../../../shared/api/http";
import { IllustrationPanel, PlanGenerateIllustration, PlanLoadFailIllustration } from "../../../shared/graphics";

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

function recipeNameById(recipes: Array<{ id: string; name: string }> | undefined, recipeId: string | null | undefined) {
  if (!recipeId) return null;
  const found = (recipes ?? []).find((r) => r.id === recipeId);
  return found?.name ?? null;
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
        navigate(
          v === "plan" ? `/plan?week=${encodeURIComponent(weekStart)}` : `/plan/grocery?week=${encodeURIComponent(weekStart)}`
        );
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
  const [toast, setToast] = useState<string | null>(null);
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

  const recipesQuery = useRecipesListQuery();
  const swapMutation = useSwapWeeklyPlanMealMutation(weekStart);
  const lockMutation = useSetWeeklyPlanMealLockMutation(weekStart);

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapMeal, setSwapMeal] = useState<{ date: string; meal: WeeklyPlanMeal } | null>(null);
  const [swapRecipeId, setSwapRecipeId] = useState<string>("");
  const [swapLock, setSwapLock] = useState(true);

  const swapRecipeInputRef = useRef<HTMLInputElement | null>(null);
  const swapContextId = useMemo(() => {
    if (!swapMeal) return "swap-meal-context";
    return `swap-meal-context-${swapMeal.date}-${swapMeal.meal.meal_type}`;
  }, [swapMeal]);

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

    const res = await genMutation.mutateAsync(payload);
    const s = res.generation_summary;
    if (s) {
      setToast(`Plan generated • ${s.locked_kept} locked kept`);
    } else {
      setToast("Plan generated");
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Stack spacing={2}>
        {/* Compact header/toolbar */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="h1" noWrap>
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
          <IllustrationPanel
            title="Couldn’t load your weekly plan"
            description="Check your connection and try again. Your generator settings are still here."
            illustration={<PlanLoadFailIllustration className="foodie-illustration" />}
            actions={
              <>
                <Button variant="contained" onClick={() => planQuery.refetch()} size="small">
                  Retry
                </Button>
              </>
            }
          />
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
                    boxShadow: (t) =>
                      isActive ? `0 0 0 2px ${t.palette.primary.main}` : `0 0 0 1px ${t.palette.divider}`,
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
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box aria-hidden sx={{ width: 30, height: 30, opacity: 0.95 }}>
                  <PlanGenerateIllustration className="foodie-gen-mark" />
                </Box>
                <Typography variant="subtitle2">Generator</Typography>
              </Stack>
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
              Change recipes: open a day and use “Change recipe”.
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

            {drawerDay?.totals ? (
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
                .map((m) => {
                  const recipeName = recipeNameById(recipesQuery.data, m.recipe_id);

                  return (
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
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap>
                              {m.meal_type}
                            </Typography>
                            {m.locked ? (
                              <Chip
                                size="small"
                                color="default"
                                icon={<LockIcon />}
                                label="Locked"
                                variant="outlined"
                                aria-label={`${m.meal_type} locked`}
                              />
                            ) : null}
                          </Stack>
                          <Typography variant="body2" noWrap title={recipeName ?? ""}>
                            {recipeName ?? "—"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Servings: {Number(m.servings).toFixed(2)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              if (!drawerDay?.date) return;
                              try {
                                await lockMutation.mutateAsync({ mealId: m.id, locked: !m.locked });
                                setToast(!m.locked ? `${m.meal_type} locked` : `${m.meal_type} unlocked`);
                              } catch {
                                setToast("Failed to update lock");
                              }
                            }}
                            aria-label={m.locked ? `Unlock ${m.meal_type}` : `Lock ${m.meal_type}`}
                          >
                            {m.locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                          </IconButton>

                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SwapHorizIcon />}
                            onClick={() => {
                              if (!drawerDay?.date) return;
                              setSwapMeal({ date: drawerDay.date, meal: m });
                              setSwapRecipeId(m.recipe_id ?? "");
                              setSwapLock(true);
                              setSwapOpen(true);
                            }}
                            aria-label={`Change recipe for ${m.meal_type}`}
                          >
                            Change recipe
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  if (!drawerDay?.date) return;
                  navigate(`/day/${drawerDay.date}`);
                }}
                aria-label="Open day log"
              >
                Open day log
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<LocalGroceryStoreIcon />}
                onClick={() => navigate(`/plan/grocery?week=${encodeURIComponent(weekStart)}`)}
              >
                Open grocery list
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Drawer>

      <Dialog
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="swap-meal-title"
        aria-describedby={swapContextId}
      >
        <DialogTitle id="swap-meal-title">Change recipe</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography id={swapContextId} variant="body2" color="text.secondary">
              {swapMeal ? `${swapMeal.date} • ${swapMeal.meal.meal_type}` : ""}
            </Typography>

            {recipesQuery.isLoading ? <LinearProgress /> : null}

            <Autocomplete
              fullWidth
              size="small"
              options={recipesQuery.data ?? []}
              loading={recipesQuery.isLoading}
              value={(recipesQuery.data ?? []).find((r) => r.id === swapRecipeId) ?? null}
              onChange={(_e, v) => setSwapRecipeId(v?.id ?? "")}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              getOptionLabel={(o) => o.name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Recipe"
                  inputRef={(el) => {
                    swapRecipeInputRef.current = el;
                    const originalRef = params.inputProps.ref;
                    if (typeof originalRef === "function") originalRef(el);
                    else if (originalRef) (originalRef as any).current = el;
                  }}
                  autoFocus
                  inputProps={{
                    ...params.inputProps,
                    "data-testid": "swap-recipe-autocomplete",
                    "aria-describedby": swapContextId,
                  }}
                />
              )}
            />

            <FormControlLabel
              control={<Switch checked={swapLock} onChange={(e) => setSwapLock(e.target.checked)} />}
              label={
                <Stack spacing={0.25}>
                  <Typography variant="body2">Lock this meal</Typography>
                  <Typography variant="caption" color="text.secondary">
                    If unlocked, future regenerations may replace this meal.
                  </Typography>
                </Stack>
              }
            />

            {swapMutation.isError ? (
              <Alert severity="error">
                {(() => {
                  const err = swapMutation.error;
                  if (isApiError(err)) return err.data.error.message ?? "We couldn’t change this recipe. Please try again.";
                  return "We couldn’t change this recipe. Please try again.";
                })()}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwapOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!swapMeal || !swapRecipeId || swapMutation.isPending}
            onClick={async () => {
              if (!swapMeal) return;
              const payload: SwapWeeklyPlanMealRequest = {
                date: swapMeal.date,
                meal_type: swapMeal.meal.meal_type,
                new_recipe_id: swapRecipeId,
                lock: swapLock,
              };
              try {
                await swapMutation.mutateAsync(payload);
                setSwapOpen(false);
                setToast(swapLock ? "Meal swapped and locked" : "Meal swapped");
              } catch {
                // Keep dialog open on error; error UI is shown above.
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Container>
  );
}
