import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";

export type WeighInDraft = {
  datetime: string;
  weight_kg: number;
  note?: string | null;
};

function parseWeight(input: string): number | null {
  const normalized = input.replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function validateWeightKg(weightKg: number | null): string | null {
  if (weightKg === null) return "Enter your weight.";
  if (weightKg < 20) return "That seems too low. Minimum is 20 kg.";
  if (weightKg > 500) return "That seems too high. Maximum is 500 kg.";
  return null;
}

export function AddWeighInDialog({
  open,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initial?: { datetime?: Dayjs; weight_kg?: number; note?: string | null };
  onClose: () => void;
  onSubmit: (draft: WeighInDraft) => void;
  submitting: boolean;
}) {
  const [weightInput, setWeightInput] = useState<string>("");
  const [dt, setDt] = useState<Dayjs>(dayjs());
  const [note, setNote] = useState<string>("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWeightInput(initial?.weight_kg !== undefined ? String(initial.weight_kg) : "");
    setDt(initial?.datetime ?? dayjs());
    setNote(initial?.note ?? "");
    setTouched(false);
  }, [open, initial?.datetime, initial?.note, initial?.weight_kg]);

  const weightKg = useMemo(() => parseWeight(weightInput), [weightInput]);
  const weightError = touched ? validateWeightKg(weightKg) : null;

  const canSubmit = !validateWeightKg(weightKg) && dt.isValid();

  const submit = () => {
    setTouched(true);
    const err = validateWeightKg(weightKg);
    if (err) return;
    onSubmit({
      datetime: dt.toISOString(),
      weight_kg: weightKg!,
      note: note.trim().length ? note.trim() : null,
    });
  };

  const setQuick = (which: "today" | "yesterday") => {
    const base = which === "today" ? dayjs() : dayjs().subtract(1, "day");
    setDt(base);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pr: 6 }}>
        Add weigh-in
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Quick:
            </Typography>
            <Button size="small" onClick={() => setQuick("today")}>
              Today
            </Button>
            <Button size="small" onClick={() => setQuick("yesterday")}>
              Yesterday
            </Button>
          </Stack>

          <TextField
            label="Weight (kg)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            onBlur={() => setTouched(true)}
            inputMode="decimal"
            autoFocus
            error={Boolean(weightError)}
            helperText={weightError ?? "Use a dot or comma. Example: 80.5"}
          />

          <DateTimePicker label="Date & time" value={dt} onChange={(next) => next && setDt(next)} />

          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
            helperText={`${note.length}/500`}
          />

          <Alert severity="info">Stored time is normalized to UTC on the server.</Alert>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit || submitting}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
