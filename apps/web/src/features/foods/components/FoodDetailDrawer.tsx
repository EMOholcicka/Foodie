import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import type { Food } from "../api/foodsApi";

export type FoodDetailDrawerProps = {
  open: boolean;
  food: Food | null;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  onClose: () => void;
  onAdd: (args: { foodId: string; grams: number; mealType: FoodDetailDrawerProps["mealType"] }) => void;
  pending?: boolean;
};

function clampPositiveNumber(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, v);
}

function parseGramsInput(text: string): number {
  const normalized = text.replace(",", ".").trim();
  const x = Number(normalized);
  return clampPositiveNumber(x);
}

export function FoodDetailDrawer(props: FoodDetailDrawerProps) {
  const [gramsText, setGramsText] = useState<string>("100");

  useEffect(() => {
    // Reset portion when opening or when switching foods while open,
    // so we don't carry stale grams/validation across foods.
    if (!props.open) return;
    setGramsText("100");
  }, [props.open, props.food?.id]);

  const grams = useMemo(() => parseGramsInput(gramsText), [gramsText]);
  const gramsError = gramsText.trim().length > 0 && grams <= 0;

  const macros = useMemo(() => {
    const f = props.food;
    if (!f) return null;
    const factor = grams / 100;
    return {
      kcal: f.kcal_100g * factor,
      p: f.protein_100g * factor,
      c: f.carbs_100g * factor,
      fat: f.fat_100g * factor,
    };
  }, [props.food, grams]);

  const presets = [50, 100, 200] as const;

  const pending = props.pending === true;

  return (
    <Drawer
      anchor="bottom"
      open={props.open}
      onClose={pending ? undefined : props.onClose}
      PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
      ModalProps={{
        disableEscapeKeyDown: pending,
        // When pending we also prevent backdrop click from closing.
        onClose: pending
          ? (event, reason) => {
              if (reason === "escapeKeyDown" || reason === "backdropClick") return;
              props.onClose();
            }
          : undefined,
      }}
    >
      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {props.food?.name ?? "Food"}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {props.food?.brand ?? (props.food ? "No brand" : "")}
            </Typography>
          </Box>
          <IconButton onClick={props.onClose} aria-label="Close" disabled={pending}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" color="text.secondary">
          Per 100g
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: "wrap" }}>
          <Typography variant="body2">kcal {props.food?.kcal_100g ?? "-"}</Typography>
          <Typography variant="body2">P {props.food?.protein_100g ?? "-"}g</Typography>
          <Typography variant="body2">C {props.food?.carbs_100g ?? "-"}g</Typography>
          <Typography variant="body2">F {props.food?.fat_100g ?? "-"}g</Typography>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2">Portion</Typography>
        <TextField
          sx={{ mt: 1 }}
          label="Grams"
          value={gramsText}
          onChange={(e) => setGramsText(e.target.value)}
          inputMode="decimal"
          error={gramsError}
          helperText={gramsError ? "Enter grams greater than 0." : " "}
          disabled={props.pending}
          InputProps={{ endAdornment: <InputAdornment position="end">g</InputAdornment> }}
        />

        <ToggleButtonGroup
          exclusive
          size="small"
          value={presets.includes(grams as (typeof presets)[number]) ? grams : null}
          onChange={(_, next) => {
            if (typeof next === "number") setGramsText(String(next));
          }}
          sx={{ mt: 1 }}
          disabled={props.pending}
        >
          {presets.map((p) => (
            <ToggleButton key={p} value={p} aria-label={`${p} grams`}>
              {p}g
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={2} sx={{ mt: 2, flexWrap: "wrap" }}>
          <Typography variant="body2">kcal {macros ? Math.round(macros.kcal) : "-"}</Typography>
          <Typography variant="body2">P {macros ? macros.p.toFixed(1) : "-"}g</Typography>
          <Typography variant="body2">C {macros ? macros.c.toFixed(1) : "-"}g</Typography>
          <Typography variant="body2">F {macros ? macros.fat.toFixed(1) : "-"}g</Typography>
        </Stack>

        <Button
          sx={{ mt: 2 }}
          fullWidth
          variant="contained"
          disabled={!props.food || grams <= 0 || !!gramsError || props.pending}
          onClick={() => {
            if (!props.food) return;
            props.onAdd({ foodId: props.food.id, grams, mealType: props.mealType });
          }}
        >
          Add to {props.mealType}
        </Button>
      </Box>
    </Drawer>
  );
}
