import AddIcon from "@mui/icons-material/Add";
import LoginIcon from "@mui/icons-material/Login";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Fab,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { login } from "../../../shared/api/auth";
import { CreateWeightRequest, deleteWeight, listWeights, updateWeight, WeightEntry } from "../../../shared/api/weights";
import { AddWeighInDialog } from "../components/AddWeighInDialog";
import { TrendSummaryCard } from "../components/TrendSummaryCard";
import { WeightChartCard } from "../components/WeightChartCard";
import { WeightHistoryTable } from "../components/WeightHistoryTable";
import { sortByDatetimeAsc } from "../domain/trends";

const qk = {
  weights: () => ["weights"] as const,
};

const UNDO_MS = 6000;

type DeferredDelete = {
  item: WeightEntry;
  timeoutId: number;
};

export function WeightRoute() {
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);

  // Dev login UI (minimal)
  const [email, setEmail] = useState("demo@foodie.local");
  const [password, setPassword] = useState("demo12345");
  const [loginErr, setLoginErr] = useState<string | null>(null);

  const weightsQuery = useQuery({
    queryKey: qk.weights(),
    queryFn: () => listWeights(),
  });

  const createMut = useMutation({
    mutationFn: async (_: CreateWeightRequest) => {
      // create endpoint exists; left unchanged for Phase 3; not used for undo anymore
      const { createWeight } = await import("../../../shared/api/weights");
      return createWeight(_);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.weights() });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { datetime?: string; weight_kg?: number } }) =>
      updateWeight(id, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.weights() });
    },
  });

  const deferredDeleteRef = useRef<DeferredDelete | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);

  const deleteMut = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await deleteWeight(id);
    },
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: qk.weights() });
      const prev = qc.getQueryData<WeightEntry[]>(qk.weights());
      const current = (prev ?? []).find((x) => x.id === id);

      if (current) {
        // optimistic remove
        qc.setQueryData<WeightEntry[]>(qk.weights(), (old) => (old ?? []).filter((x) => x.id !== id));

        // schedule server delete (true undo = cancel + reinsert, not recreate)
        const timeoutId = window.setTimeout(() => {
          deleteMut.mutate({ id });
          deferredDeleteRef.current = null;
        }, UNDO_MS);
        deferredDeleteRef.current = { item: current, timeoutId };
        setSnackOpen(true);
      }

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.weights(), ctx.prev);
    },
    onSettled: async () => {
      // avoid refetch spam while undo window is active
      if (!deferredDeleteRef.current) {
        await qc.invalidateQueries({ queryKey: qk.weights() });
      }
    },
  });

  const undoDelete = () => {
    const pending = deferredDeleteRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    deferredDeleteRef.current = null;

    // restore cached item
    qc.setQueryData<WeightEntry[]>(qk.weights(), (old) => {
      const next = [...(old ?? []), pending.item];
      return next;
    });

    setSnackOpen(false);
  };

  const points = useMemo(() => {
    const items = weightsQuery.data ?? [];
    return sortByDatetimeAsc(items).map((i) => ({ datetime: i.datetime, weight_kg: i.weight_kg }));
  }, [weightsQuery.data]);

  const shownHistoryItems = useMemo(() => weightsQuery.data ?? [], [weightsQuery.data]);

  const isAuthError = (weightsQuery.error as any)?.response?.status === 401;

  return (
    <Container maxWidth="md" sx={{ py: 2, pb: 10 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Weight</Typography>

        {isAuthError ? (
          <Alert severity="warning">You are not logged in. Use the dev login below.</Alert>
        ) : null}

        {isAuthError ? (
          <Box component="section">
            <Typography variant="h6" sx={{ mb: 1 }}>
              Dev login
            </Typography>
            {loginErr ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                {loginErr}
              </Alert>
            ) : null}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={createMut.isPending}
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={createMut.isPending}
              />
              <Button
                variant="contained"
                startIcon={<LoginIcon />}
                disabled={createMut.isPending}
                onClick={async () => {
                  setLoginErr(null);
                  try {
                    await login({ email, password });
                    await qc.invalidateQueries({ queryKey: qk.weights() });
                  } catch (e: any) {
                    setLoginErr(e?.message ?? "Login failed.");
                  }
                }}
              >
                {createMut.isPending ? "Logging in…" : "Login"}
              </Button>
            </Stack>
          </Box>
        ) : null}

        {weightsQuery.isLoading ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={20} />
            <Typography color="text.secondary">Loading weigh-ins…</Typography>
          </Stack>
        ) : null}

        {weightsQuery.isError && !isAuthError ? (
          <Alert severity="error">
            Failed to load weigh-ins: {(weightsQuery.error as Error).message}
          </Alert>
        ) : null}

        {!weightsQuery.isLoading && !weightsQuery.isError ? (
          <>
            <TrendSummaryCard points={points} />
            <WeightChartCard points={points} />
            <WeightHistoryTable
              items={shownHistoryItems}
              deletingId={deferredDeleteRef.current?.item.id ?? null}
              editPendingId={updateMut.isPending ? (updateMut.variables as any)?.id ?? null : null}
              editError={updateMut.isError ? (updateMut.error as Error).message : null}
              onUpdate={async (id, patch) => {
                await updateMut.mutateAsync({ id, patch });
              }}
              onDelete={(id) => {
                deleteMut.mutate({ id });
              }}
            />
          </>
        ) : null}
      </Stack>

      <Fab
        color="primary"
        variant="extended"
        onClick={() => setAddOpen(true)}
        sx={{ position: "fixed", right: 16, bottom: 88 }}
      >
        <AddIcon sx={{ mr: 1 }} /> Add weigh-in
      </Fab>

      <AddWeighInDialog
        open={addOpen}
        submitting={createMut.isPending}
        onClose={() => setAddOpen(false)}
        onSubmit={(draft) => {
          createMut.mutate(draft, {
            onSuccess: () => {
              setAddOpen(false);
            },
          });
        }}
        initial={{ datetime: dayjs() }}
      />

      <Snackbar
        open={snackOpen}
        onClose={() => {
          setSnackOpen(false);
        }}
        message="Weigh-in deleted"
        autoHideDuration={UNDO_MS}
        action={
          <Button color="inherit" onClick={undoDelete}>
            Undo
          </Button>
        }
      />
    </Container>
  );
}
