import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  LinearProgress,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePutTargetsMutation, useTargetsQuery } from "../api/targetsQueries";
import { getModeFromTargets, kcalFromMacros, mismatchInfo, type TargetsMode } from "../domain/targetsMath";

type FormState = {
  mode: TargetsMode;
  kcal_target: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
};

function parseLocaleNumber(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "") return NaN;
  // Accept commas as decimal separator.
  const normalized = trimmed.replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function presetValues(key: "recomposition" | "endurance" | "maintenance") {
  // Simple starter presets; user can customize.
  switch (key) {
    case "recomposition":
      return { kcal_target: 2200, protein_g: 170, carbs_g: 200, fat_g: 70 };
    case "endurance":
      return { kcal_target: 2800, protein_g: 150, carbs_g: 360, fat_g: 70 };
    case "maintenance":
      return { kcal_target: 2500, protein_g: 160, carbs_g: 280, fat_g: 80 };
  }
}

function normalizeTargetsForCompare(t: {
  mode: TargetsMode;
  kcal_target: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}) {
  if (t.mode === "kcal") {
    return { mode: "kcal" as const, kcal_target: t.kcal_target, protein_g: 0, carbs_g: 0, fat_g: 0 };
  }
  // Ensure stable compare values
  return {
    mode: "macros" as const,
    kcal_target: t.kcal_target,
    protein_g: Math.round(t.protein_g * 10) / 10,
    carbs_g: Math.round(t.carbs_g * 10) / 10,
    fat_g: Math.round(t.fat_g * 10) / 10,
  };
}

export function TargetsRoute() {
  const targetsQuery = useTargetsQuery();
  const saveMutation = usePutTargetsMutation();

  const [form, setForm] = useState<FormState>({
    mode: "kcal",
    kcal_target: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
  });

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [presetUndo, setPresetUndo] = useState<null | { prev: FormState; label: string }>(null);

  const didInitFromQueryRef = useRef(false);

  useEffect(() => {
    if (didInitFromQueryRef.current) return;
    if (!targetsQuery.data) return;

    const t = targetsQuery.data;
    const mode = getModeFromTargets(t);

    setForm({
      mode,
      kcal_target: String(t.kcal_target ?? 0),
      protein_g: mode === "macros" ? String(t.protein_g ?? 0) : "",
      carbs_g: mode === "macros" ? String(t.carbs_g ?? 0) : "",
      fat_g: mode === "macros" ? String(t.fat_g ?? 0) : "",
    });

    didInitFromQueryRef.current = true;
  }, [targetsQuery.data]);

  const parsed = useMemo(() => {
    return {
      mode: form.mode,
      kcal_target: parseLocaleNumber(form.kcal_target),
      protein_g: parseLocaleNumber(form.protein_g),
      carbs_g: parseLocaleNumber(form.carbs_g),
      fat_g: parseLocaleNumber(form.fat_g),
    };
  }, [form]);

  const fieldErrors = useMemo(() => {
    const errs: Partial<Record<keyof Omit<FormState, "mode">, string>> = {};

    if (form.kcal_target.trim() !== "" && Number.isNaN(parsed.kcal_target)) errs.kcal_target = "Enter a number";
    if (form.mode === "macros") {
      if (form.protein_g.trim() !== "" && Number.isNaN(parsed.protein_g)) errs.protein_g = "Enter a number";
      if (form.carbs_g.trim() !== "" && Number.isNaN(parsed.carbs_g)) errs.carbs_g = "Enter a number";
      if (form.fat_g.trim() !== "" && Number.isNaN(parsed.fat_g)) errs.fat_g = "Enter a number";
    }

    if (!Number.isNaN(parsed.kcal_target) && parsed.kcal_target < 0) errs.kcal_target = "Must be ≥ 0";
    if (form.mode === "macros") {
      if (!Number.isNaN(parsed.protein_g) && parsed.protein_g < 0) errs.protein_g = "Must be ≥ 0";
      if (!Number.isNaN(parsed.carbs_g) && parsed.carbs_g < 0) errs.carbs_g = "Must be ≥ 0";
      if (!Number.isNaN(parsed.fat_g) && parsed.fat_g < 0) errs.fat_g = "Must be ≥ 0";
    }

    return errs;
  }, [form, parsed]);

  const numeric = useMemo(() => {
    const mode = form.mode;

    const kcal_target = Number.isNaN(parsed.kcal_target) || parsed.kcal_target < 0 ? 0 : Math.round(parsed.kcal_target);

    const protein_g = Number.isNaN(parsed.protein_g) || parsed.protein_g < 0 ? 0 : parsed.protein_g;
    const carbs_g = Number.isNaN(parsed.carbs_g) || parsed.carbs_g < 0 ? 0 : parsed.carbs_g;
    const fat_g = Number.isNaN(parsed.fat_g) || parsed.fat_g < 0 ? 0 : parsed.fat_g;

    if (mode === "kcal") {
      return { mode, kcal_target, protein_g: 0, carbs_g: 0, fat_g: 0 };
    }

    return { mode, kcal_target, protein_g, carbs_g, fat_g };
  }, [form.mode, parsed]);

  const serverBaseline = useMemo(() => {
    if (!targetsQuery.data) return null;
    const mode = getModeFromTargets(targetsQuery.data);
    return normalizeTargetsForCompare({
      mode,
      kcal_target: targetsQuery.data.kcal_target,
      protein_g: targetsQuery.data.protein_g,
      carbs_g: targetsQuery.data.carbs_g,
      fat_g: targetsQuery.data.fat_g,
    });
  }, [targetsQuery.data]);

  const localSnapshot = useMemo(() => {
    return normalizeTargetsForCompare({
      mode: numeric.mode,
      kcal_target: numeric.kcal_target,
      protein_g: numeric.protein_g,
      carbs_g: numeric.carbs_g,
      fat_g: numeric.fat_g,
    });
  }, [numeric]);

  const isDirty = useMemo(() => {
    if (!serverBaseline) return true;
    return JSON.stringify(serverBaseline) !== JSON.stringify(localSnapshot);
  }, [serverBaseline, localSnapshot]);

  // Clear success feedback when the user changes inputs after a save.
  useEffect(() => {
    if (saveMutation.isSuccess && isDirty) {
      setSnackbarOpen(false);
    }
  }, [isDirty, saveMutation.isSuccess]);

  const kcalFromMacrosValue = useMemo(() => {
    if (numeric.mode !== "macros") return 0;
    return kcalFromMacros(numeric);
  }, [numeric]);

  const mismatch = useMemo(() => {
    if (numeric.mode !== "macros") return null;
    return mismatchInfo(numeric);
  }, [numeric]);

  const canSave = useMemo(() => {
    if (!isDirty) return false;
    if (Object.keys(fieldErrors).length > 0) return false;
    if (numeric.kcal_target <= 0) return false;
    if (numeric.mode === "kcal") return true;
    // API validates protein>=20g when kcal_target>0
    return numeric.protein_g >= 20;
  }, [fieldErrors, isDirty, numeric]);

  async function onSave() {
    try {
      await saveMutation.mutateAsync({
        kcal_target: numeric.kcal_target,
        protein_g: numeric.protein_g,
        carbs_g: numeric.carbs_g,
        fat_g: numeric.fat_g,
        effective_date: null,
      });
      setSnackbarOpen(true);
      setPresetUndo(null);
    } catch {
      // Errors are surfaced via saveMutation.isError; swallow to avoid unhandled rejections.
    }
  }

  function applyPreset(key: "recomposition" | "endurance" | "maintenance") {
    const prev = form;
    const p = presetValues(key);
    setPresetUndo({ prev, label: key });
    setForm((s) => ({
      ...s,
      mode: "macros",
      kcal_target: String(p.kcal_target),
      protein_g: String(p.protein_g),
      carbs_g: String(p.carbs_g),
      fat_g: String(p.fat_g),
    }));
  }

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2}>
          <Typography variant="h5">Targets</Typography>
          <Typography variant="caption" color="text.secondary">
            kcal & macros
          </Typography>
        </Stack>

        {targetsQuery.isLoading ? <LinearProgress aria-label="Loading targets" /> : null}

        {targetsQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => targetsQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Failed to load targets.
          </Alert>
        ) : null}

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Mode
                </Typography>
                <ToggleButtonGroup
                  color="primary"
                  value={form.mode}
                  exclusive
                  onChange={(_, v: TargetsMode | null) => {
                    if (!v) return;
                    setForm((s) => ({
                      ...s,
                      mode: v,
                      protein_g: v === "macros" ? s.protein_g : "",
                      carbs_g: v === "macros" ? s.carbs_g : "",
                      fat_g: v === "macros" ? s.fat_g : "",
                    }));
                  }}
                  aria-label="Targets mode"
                  fullWidth
                  size="small"
                >
                  <ToggleButton value="kcal" aria-label="kcal only">
                    kcal only
                  </ToggleButton>
                  <ToggleButton value="macros" aria-label="kcal and macros">
                    kcal + macros
                  </ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                  kcal only: just set a daily calorie target. kcal + macros: set protein/carbs/fat and keep calories consistent.
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Presets
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="outlined" onClick={() => applyPreset("recomposition")}>
                    Recomposition
                  </Button>
                  <Button variant="outlined" onClick={() => applyPreset("endurance")}>
                    Endurance
                  </Button>
                  <Button variant="outlined" onClick={() => applyPreset("maintenance")}>
                    Maintenance
                  </Button>
                </Stack>
                {presetUndo ? (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Preset applied (overwrote your inputs).
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => {
                        setForm(presetUndo.prev);
                        setPresetUndo(null);
                      }}
                    >
                      Undo
                    </Button>
                  </Stack>
                ) : null}
              </Box>

              <Divider />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="kcal target"
                  type="number"
                  inputProps={{ min: 0 }}
                  value={form.kcal_target}
                  onChange={(e) => setForm((s) => ({ ...s, kcal_target: e.target.value }))}
                  fullWidth
                  error={Boolean(fieldErrors.kcal_target)}
                  helperText={fieldErrors.kcal_target}
                />
              </Stack>

              {form.mode === "macros" ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Protein (g)"
                    type="number"
                    inputProps={{ min: 0 }}
                    value={form.protein_g}
                    onChange={(e) => setForm((s) => ({ ...s, protein_g: e.target.value }))}
                    fullWidth
                    error={Boolean(fieldErrors.protein_g)}
                    helperText={fieldErrors.protein_g ?? "Min 20g (API rule)"}
                  />
                  <TextField
                    label="Carbs (g)"
                    type="number"
                    inputProps={{ min: 0 }}
                    value={form.carbs_g}
                    onChange={(e) => setForm((s) => ({ ...s, carbs_g: e.target.value }))}
                    fullWidth
                    error={Boolean(fieldErrors.carbs_g)}
                    helperText={fieldErrors.carbs_g}
                  />
                  <TextField
                    label="Fat (g)"
                    type="number"
                    inputProps={{ min: 0 }}
                    value={form.fat_g}
                    onChange={(e) => setForm((s) => ({ ...s, fat_g: e.target.value }))}
                    fullWidth
                    error={Boolean(fieldErrors.fat_g)}
                    helperText={fieldErrors.fat_g}
                  />
                </Stack>
              ) : null}

              {form.mode === "macros" ? (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Macros kcal (computed): {Math.round(kcalFromMacrosValue)} kcal
                  </Typography>
                  {mismatch?.mismatched ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      Your values don’t add up: macros compute to ≈ {Math.round(kcalFromMacrosValue)} kcal, but your kcal target is {numeric.kcal_target}.
                      <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                        <li>
                          Adjust <strong>kcal target</strong> to {Math.round(kcalFromMacrosValue)} to match your macros, or
                        </li>
                        <li>
                          Adjust <strong>protein/carbs/fat</strong> so they compute to {numeric.kcal_target} kcal.
                        </li>
                      </Box>
                    </Alert>
                  ) : null}
                </Box>
              ) : null}

              {saveMutation.isError ? (
                <Alert severity="error">Failed to save targets. Please check values and try again.</Alert>
              ) : null}

              <Button variant="contained" disabled={!canSave || saveMutation.isPending} onClick={onSave}>
                {saveMutation.isPending ? "Saving…" : "Save targets"}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {targetsQuery.isSuccess && targetsQuery.data ? (
          <Typography variant="caption" color="text.secondary">
            Current: {targetsQuery.data.kcal_target} kcal • P {targetsQuery.data.protein_g}g • C {targetsQuery.data.carbs_g}g • F{" "}
            {targetsQuery.data.fat_g}g
          </Typography>
        ) : targetsQuery.isSuccess ? (
          <Typography variant="caption" color="text.secondary">
            Targets not set.
          </Typography>
        ) : null}

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={2500}
          onClose={() => setSnackbarOpen(false)}
          message="Targets saved"
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        />
      </Stack>
    </Container>
  );
}
