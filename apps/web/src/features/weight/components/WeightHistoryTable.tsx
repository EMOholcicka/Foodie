import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import UndoIcon from "@mui/icons-material/Undo";
import {
  IconButton,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

import { WeightEntry } from "../../../shared/api/weights";

function fmtDt(iso: string) {
  return dayjs(iso).format("YYYY-MM-DD HH:mm");
}

function fmtKg(n: number) {
  return `${n.toFixed(1)} kg`;
}

function parseWeight(input: string): number | null {
  const normalized = input.replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function WeightHistoryTable({
  items,
  onUpdate,
  onDelete,
  deletingId,
  editPendingId,
  editError,
}: {
  items: WeightEntry[];
  onUpdate: (id: string, patch: { weight_kg?: number; datetime?: string }) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  editPendingId: string | null;
  editError: string | null;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState<string>("");
  const [dtInput, setDtInput] = useState<string>("");
  const [snackOpen, setSnackOpen] = useState(false);

  const rows = useMemo(
    () => [...items].sort((a, b) => dayjs(b.datetime).valueOf() - dayjs(a.datetime).valueOf()),
    [items]
  );

  const startEdit = (e: WeightEntry) => {
    setEditId(e.id);
    setWeightInput(String(e.weight_kg));
    setDtInput(dayjs(e.datetime).format("YYYY-MM-DDTHH:mm"));
  };

  const saveEdit = async (e: WeightEntry) => {
    const w = parseWeight(weightInput);
    if (w === null || w < 20 || w > 500) return;
    const dt = dayjs(dtInput);
    if (!dt.isValid()) return;
    await onUpdate(e.id, { weight_kg: w, datetime: dt.toISOString() });
    setEditId(null);
  };

  const doDelete = (id: string) => {
    onDelete(id);
    setSnackOpen(true);
  };

  return (
    <>
      <Typography variant="h6" sx={{ mb: 1 }}>
        History
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Weight</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((e) => {
              const editing = editId === e.id;
              const editPending = editPendingId === e.id;
              return (
                <TableRow key={e.id} hover>
                  <TableCell>
                    {editing ? (
                      <TextField
                        aria-label="Edit datetime"
                        value={dtInput}
                        onChange={(ev) => setDtInput(ev.target.value)}
                        type="datetime-local"
                        size="small"
                        disabled={editPending}
                      />
                    ) : (
                      fmtDt(e.datetime)
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {editing ? (
                      <TextField
                        aria-label="Edit weight"
                        value={weightInput}
                        onChange={(ev) => setWeightInput(ev.target.value)}
                        size="small"
                        inputMode="decimal"
                        disabled={editPending}
                      />
                    ) : (
                      fmtKg(e.weight_kg)
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {editing ? (
                      <Tooltip title={editPending ? "Saving…" : "Save"}>
                        <span>
                          <IconButton
                            aria-label="Save"
                            onClick={() => saveEdit(e)}
                            disabled={editPending}
                          >
                            <SaveIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Edit">
                        <span>
                          <IconButton
                            aria-label="Edit"
                            onClick={() => startEdit(e)}
                            disabled={Boolean(editPendingId) || Boolean(deletingId)}
                          >
                            <EditIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <span>
                        <IconButton
                          aria-label="Delete"
                          onClick={() => doDelete(e.id)}
                          disabled={deletingId === e.id || Boolean(editPendingId)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary">No weigh-ins yet.</Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar
        open={snackOpen}
        onClose={() => setSnackOpen(false)}
        message="Weigh-in deleted"
        autoHideDuration={6000}
        action={
          <IconButton
            aria-label="Undo"
            color="inherit"
            onClick={() => {
              setSnackOpen(false);
            }}
          >
            <UndoIcon />
          </IconButton>
        }
      />

      {editError ? (
        <Typography sx={{ mt: 1 }} variant="caption" color="error">
          {editError}
        </Typography>
      ) : null}
    </>
  );
}
