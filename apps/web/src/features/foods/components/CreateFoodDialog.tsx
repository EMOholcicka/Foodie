import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createFood, type CreateFoodRequest } from "../api/foodsApi";
import { validateCreateFood } from "../domain/foodValidation";

export type CreateFoodDialogProps = {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated?: (foodId: string) => void;
};

function num(v: string): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
}

export function CreateFoodDialog(props: CreateFoodDialogProps) {
  const qc = useQueryClient();

  const [name, setName] = useState(props.initialName ?? "");
  const [brand, setBrand] = useState<string>("");
  const [kcal, setKcal] = useState("0");
  const [p, setP] = useState("0");
  const [c, setC] = useState("0");
  const [f, setF] = useState("0");

  const mutation = useMutation({
    mutationFn: createFood,
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ["foods"] });
      props.onCreated?.(created.id);
      props.onClose();
    },
  });

  useEffect(() => {
    if (!props.open) return;
    setName(props.initialName ?? "");
    setBrand("");
    setKcal("0");
    setP("0");
    setC("0");
    setF("0");
    mutation.reset();
  }, [props.open, props.initialName, mutation]);

  const req: CreateFoodRequest = useMemo(
    () => ({
      name,
      brand: brand === "" ? null : brand,
      kcal_100g: num(kcal),
      protein_100g: num(p),
      carbs_100g: num(c),
      fat_100g: num(f),
    }),
    [name, brand, kcal, p, c, f]
  );

  const v = useMemo(() => validateCreateFood(req), [req]);

  const computedKcal = useMemo(() => {
    const pn = num(p);
    const cn = num(c);
    const fn = num(f);
    if (![pn, cn, fn].every((x) => Number.isFinite(x))) return null;
    return pn * 4 + cn * 4 + fn * 9;
  }, [p, c, f]);

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create food</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mutation.isError ? <Alert severity="error">Failed to create food. Please try again.</Alert> : null}

          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!v.errors.name}
            helperText={v.errors.name}
            autoFocus
          />
          <TextField label="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="kcal / 100g"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              error={!!v.errors.kcal_100g}
              helperText={
                v.errors.kcal_100g ?? (computedKcal != null ? `Macros imply ~${Math.round(computedKcal)} kcal` : "")
              }
              inputMode="decimal"
            />
            <TextField
              label="Protein g / 100g"
              value={p}
              onChange={(e) => setP(e.target.value)}
              error={!!v.errors.protein_100g}
              helperText={v.errors.protein_100g}
              inputMode="decimal"
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Carbs g / 100g"
              value={c}
              onChange={(e) => setC(e.target.value)}
              error={!!v.errors.carbs_100g}
              helperText={v.errors.carbs_100g}
              inputMode="decimal"
            />
            <TextField
              label="Fat g / 100g"
              value={f}
              onChange={(e) => setF(e.target.value)}
              error={!!v.errors.fat_100g}
              helperText={v.errors.fat_100g}
              inputMode="decimal"
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => mutation.mutate(req)} disabled={!v.ok || mutation.isPending}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
