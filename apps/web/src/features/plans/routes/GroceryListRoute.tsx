import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import LocalGroceryStoreIcon from "@mui/icons-material/LocalGroceryStore";
import PrintIcon from "@mui/icons-material/Print";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  groceryListToClipboardText,
  groceryListToCsv,
  useBulkUpdateGroceryChecksMutation,
  useWeeklyGroceryListQuery,
} from "../api/plansQueries";
import { fmtDate, getWeekStartFromUrlOrStorage, persistLastWeekStart, weekLabel } from "../domain/week";
import type { GroceryListItem } from "../api/plansApi";

type GroupMode = "category" | "recipe";

type PlanTab = "plan" | "grocery";

function groupLabel(it: GroceryListItem, mode: GroupMode) {
  if (mode === "category") return "Grocery";
  // API provides per_recipe; if there is exactly one recipe contributor,
  // we can label the group by that recipe. Otherwise group into a stable bucket.
  if (it.per_recipe.length === 1) return it.per_recipe[0]?.recipe_name ?? "Other";
  if (it.per_recipe.length > 1) return "Multiple recipes";
  return "Other";
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

export function GroceryListRoute() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  const weekStart = useMemo(() => {
    return getWeekStartFromUrlOrStorage({ searchParams: sp, fallback: dayjs() });
  }, [sp]);

  useEffect(() => {
    persistLastWeekStart(weekStart);
  }, [weekStart]);

  const weekStartD = useMemo(() => dayjs(weekStart, "YYYY-MM-DD", true), [weekStart]);

  const q = useWeeklyGroceryListQuery(weekStart);

  const [mode, setMode] = useState<GroupMode>("category");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [printView, setPrintView] = useState(false);
  const printRequestedRef = useRef(false);

  const bulkUpdate = useBulkUpdateGroceryChecksMutation(weekStart);

  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>({
    open: false,
    msg: "",
    severity: "success",
  });

  useEffect(() => {
    // Initialize from server state for this week.
    const items = q.data?.items ?? [];
    const next: Record<string, boolean> = {};
    for (const it of items) next[it.item_key] = Boolean(it.checked);
    setChecked(next);
  }, [weekStart, q.data?.items]);

  useEffect(() => {
    // Persist to backend (debounced) for this week.
    if (!q.data) return;
    const t = window.setTimeout(() => {
      void bulkUpdate.mutateAsync(
        Object.entries(checked).map(([item_key, v]) => ({ item_key, checked: Boolean(v) }))
      );
    }, 300);
    return () => window.clearTimeout(t);
  }, [checked, weekStart, q.data, bulkUpdate]);

  const grouped = useMemo(() => {
    const items = q.data?.items ?? [];
    const map = new Map<string, GroceryListItem[]>();
    for (const it of items) {
      const k = groupLabel(it, mode);
      map.set(k, [...(map.get(k) ?? []), it]);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, arr]) =>
        [
          k,
          arr.slice().sort((a, b) => (a.food_name ?? a.item_key).localeCompare(b.food_name ?? b.item_key)),
        ] as const
      );
  }, [q.data?.items, mode]);

  const totalItems = q.data?.items?.length ?? 0;
  const checkedCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);

  async function copyToClipboard() {
    if (!q.data) return;

    try {
      await navigator.clipboard.writeText(groceryListToClipboardText(q.data, mode));
      setSnack({ open: true, msg: "Copied to clipboard.", severity: "success" });
    } catch {
      // Clipboard can fail (permissions, non-secure context, browser support).
      setSnack({
        open: true,
        msg: "Copy failed. Your browser may block clipboard access—try CSV or Print.",
        severity: "error",
      });
    }
  }

  function exportCsv() {
    if (!q.data) return;
    const csv = groceryListToCsv(q.data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grocery-${weekStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    function onBeforePrint() {
      setPrintView(true);
    }

    function onAfterPrint() {
      // Only collapse if we toggled it for a print request.
      if (!printRequestedRef.current) return;
      printRequestedRef.current = false;
      setPrintView(false);
    }

    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  function triggerPrint() {
    if (!q.data) return;
    printRequestedRef.current = true;
    // beforeprint will toggle printView; if the browser doesn't fire it, keep the manual switch.
    setPrintView(true);
    window.print();
  }

  function setWeek(nextWeekStart: string) {
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      n.set("week", nextWeekStart);
      return n;
    });
  }

  function uncheckAll() {
    setChecked({});
    setSnack({ open: true, msg: "All items unchecked.", severity: "success" });
  }

  function clearChecked() {
    // checked map only tracks checked items; clearing checked == unchecking all.
    setChecked({});
    setSnack({ open: true, msg: "Checked items cleared.", severity: "success" });
  }

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LocalGroceryStoreIcon color="action" />
              <Typography variant="h6" noWrap>
                Grocery
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap>
              Week of {weekLabel(weekStartD)}
            </Typography>
          </Stack>

          <PlanSubNav tab="grocery" weekStart={weekStart} />
        </Stack>

        {/* Week controls (matching Plan) */}
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
            <Typography variant="subtitle2">{weekLabel(weekStartD)}</Typography>
            <Typography variant="caption" color="text.secondary">
              {checkedCount}/{totalItems} checked
            </Typography>
          </Stack>

          <IconButton aria-label="Next week" onClick={() => setWeek(fmtDate(weekStartD.add(7, "day")))}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        <Box
          sx={{
            border: (t) => `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            p: 2,
            bgcolor: "background.paper",
            ...(printView
              ? {
                  "@media print": {
                    border: "none",
                    p: 0,
                  },
                }
              : null),
          }}
        >
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
              <FormControl>
                <FormLabel>Group by</FormLabel>
                <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as GroupMode)}>
                  <FormControlLabel value="category" control={<Radio />} label="Category" />
                  <FormControlLabel value="recipe" control={<Radio />} label="Recipe" />
                </RadioGroup>
              </FormControl>

              <Box sx={{ flex: 1 }} />

              <ButtonGroup variant="outlined" size="small">
                <Button startIcon={<ContentCopyIcon />} onClick={() => void copyToClipboard()} disabled={!q.data}>
                  Copy
                </Button>
                <Button startIcon={<DownloadIcon />} onClick={exportCsv} disabled={!q.data}>
                  CSV
                </Button>
                <Button startIcon={<PrintIcon />} onClick={triggerPrint} disabled={!q.data}>
                  Print
                </Button>
              </ButtonGroup>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Button variant="outlined" size="small" onClick={uncheckAll} disabled={checkedCount === 0}>
                Uncheck all
              </Button>
              <Button variant="outlined" size="small" onClick={clearChecked} disabled={checkedCount === 0}>
                Clear checked
              </Button>

              <Box sx={{ flex: 1 }} />

              <FormControlLabel
                control={<Switch checked={printView} onChange={(e) => setPrintView(e.target.checked)} />}
                label="Print-friendly"
              />
            </Stack>
          </Stack>
        </Box>

        {q.isLoading ? <LinearProgress /> : null}

        {q.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => q.refetch()}>
                Retry
              </Button>
            }
          >
            Failed to load grocery list.
          </Alert>
        ) : null}

        {q.data ? (
          <Stack spacing={2}>
            {grouped.map(([label, items]) => (
              <Box
                key={label}
                sx={{
                  border: (t) => `1px solid ${t.palette.divider}`,
                  borderRadius: 2,
                  overflow: "hidden",
                  bgcolor: "background.paper",
                }}
              >
                <Box
                  sx={{
                    px: 1.5,
                    py: 1.25,
                    bgcolor: "background.default",
                    borderBottom: (t) => `1px solid ${t.palette.divider}`,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </Typography>
                </Box>

                <List disablePadding>
                  {items.map((it) => {
                    const isChecked = checked[it.item_key] ?? false;
                    const toggle = () => setChecked((p) => ({ ...p, [it.item_key]: !(p[it.item_key] ?? false) }));
                    const displayName = it.food_name ?? it.item_key;

                    return (
                      <ListItem
                        key={it.item_key}
                        disablePadding
                        sx={{
                          borderTop: (t) => `1px solid ${t.palette.divider}`,
                          ...(isChecked ? { opacity: 0.55 } : null),
                        }}
                      >
                        <ListItemButton
                          onClick={toggle}
                          // ListItemButton is keyboard-accessible by default (Enter/Space).
                          sx={{
                            px: 1.5,
                            py: 1.75,
                            gap: 1.25,
                            "&:focus-visible": {
                              outline: (t) => `2px solid ${t.palette.primary.main}`,
                              outlineOffset: -2,
                            },
                          }}
                        >
                          <Checkbox
                            edge="start"
                            tabIndex={-1}
                            checked={isChecked}
                            onChange={toggle}
                            inputProps={{
                              "aria-label": isChecked ? `Uncheck ${displayName}` : `Check ${displayName}`,
                            }}
                          />

                          <ListItemText
                            primary={
                              <Typography variant="body2" noWrap title={displayName}>
                                {displayName}
                              </Typography>
                            }
                            sx={{ my: 0, minWidth: 0 }}
                          />

                          <Box
                            sx={{
                              ml: "auto",
                              textAlign: "right",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              lineHeight: 1.1,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {Math.round(it.total_grams)} g
                            </Typography>
                          </Box>
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
            ))}
          </Stack>
        ) : null}

        <Snackbar
          open={snack.open}
          autoHideDuration={3500}
          onClose={() => setSnack((p) => ({ ...p, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert onClose={() => setSnack((p) => ({ ...p, open: false }))} severity={snack.severity} variant="filled">
            {snack.msg}
          </Alert>
        </Snackbar>
      </Stack>
    </Container>
  );
}
