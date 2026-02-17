import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listFavoriteFoods, listFoods, listRecentFoods, type Food } from "../api/foodsApi";
import { useDebouncedValue } from "../domain/useDebouncedValue";

export type FoodSearchPanelProps = {
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  onPickFood: (food: Food) => void;
  onQuickAdd?: (args: { mealType: FoodSearchPanelProps["mealType"]; foodId: string; grams: number }) => Promise<void> | void;
  onCreateFood: (initialName?: string) => void;

  /**
   * Controls whether this component shows its own success snackbar after a quick-add.
   *
   * Default: false — safest to avoid duplicated feedback when used inside a parent dialog/picker
   * that likely closes on success and/or shows its own global snackbar.
   */
  showQuickAddFeedback?: boolean;
};

const FOOD_TABS = ["search", "recent", "favorites"] as const;
type FoodTab = (typeof FOOD_TABS)[number];

function isFoodTab(v: unknown): v is FoodTab {
  return typeof v === "string" && (FOOD_TABS as readonly string[]).includes(v);
}

export function FoodSearchPanel(props: FoodSearchPanelProps) {
  const showQuickAddFeedback = props.showQuickAddFeedback ?? false;

  const [tab, setTab] = useState<FoodTab>("search");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);

  const [quickAddPendingId, setQuickAddPendingId] = useState<string | null>(null);
  const [quickAddSuccessOpen, setQuickAddSuccessOpen] = useState(false);
  const [quickAddSuccessMsg, setQuickAddSuccessMsg] = useState<string>("Added 100g");

  const [quickAddErrorOpen, setQuickAddErrorOpen] = useState(false);
  const [quickAddErrorMsg, setQuickAddErrorMsg] = useState<string>("Failed to add");

  const searchTerm = debounced.trim();
  const searchEnabled = tab === "search" && searchTerm.length >= 2;

  const foodsQuery = useQuery({
    queryKey: ["foods", tab, tab === "search" ? searchTerm : ""],
    queryFn: async () => {
      if (tab === "search") return listFoods({ query: searchTerm, limit: 30 });
      if (tab === "recent") return listRecentFoods({ limit: 30 });
      return listFavoriteFoods({ limit: 50 });
    },
    enabled: tab !== "search" || searchEnabled,
    keepPreviousData: true,
  });

  const items = foodsQuery.data ?? [];
  const showEmpty = foodsQuery.isSuccess && items.length === 0;

  const title = useMemo(() => {
    const label = tab === "search" ? "Search" : tab === "recent" ? "Recent" : "Favorites";
    return `${label} foods`;
  }, [tab]);

  const canCreateFromQuery = query.trim().length > 0;

  return (
    <Stack spacing={2}>
      <Tabs
        value={tab}
        onChange={(_, v) => {
          if (!isFoodTab(v)) return;
          setTab(v);
        }}
        aria-label="Food picker tabs"
      >
        <Tab value="search" label="Search" />
        <Tab value="recent" label="Recent" />
        <Tab value="favorites" label="Favorites" />
      </Tabs>

      <TextField
        label="Search"
        placeholder={title}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={tab !== "search"}
        helperText={tab !== "search" ? "Search is available in the Search tab." : "Type at least 2 characters."}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <Box>
        {tab === "recent" && foodsQuery.isSuccess && items.length === 0 ? (
          <Stack spacing={1} sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No recent foods yet.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Recent foods will appear here after you add foods to a meal.
            </Typography>
          </Stack>
        ) : null}

        {tab === "favorites" && foodsQuery.isSuccess && items.length === 0 ? (
          <Stack spacing={1} sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No favorites yet.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Favorites will appear here after you star foods.
            </Typography>
          </Stack>
        ) : null}

        {foodsQuery.isError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => foodsQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Failed to load foods.
          </Alert>
        ) : null}

        {(tab !== "search" || searchEnabled) && foodsQuery.isLoading ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading
            </Typography>
          </Stack>
        ) : null}

        {!searchEnabled && tab === "search" ? (
          <Typography variant="body2" color="text.secondary">
            Start typing to search.
          </Typography>
        ) : null}

        {showEmpty ? (
          <Stack spacing={1} sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No foods found.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => props.onCreateFood(canCreateFromQuery ? query.trim() : undefined)}
            >
              Create "{canCreateFromQuery ? query.trim() : "food"}"
            </Button>
          </Stack>
        ) : null}

        <List dense disablePadding sx={{ mt: 0.5 }}>
          {items.map((f) => (
            <Box
              key={f.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                borderBottom: (t) => `1px solid ${t.palette.divider}`,
              }}
            >
              <ListItemButton sx={{ flex: 1, py: 0.75 }} onClick={() => props.onPickFood(f)}>
                <ListItemText
                  primary={f.name}
                  secondary={f.brand ? `${f.brand} • ${f.owner}` : f.owner}
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {Math.round(f.kcal_100g)} kcal
                </Typography>
              </ListItemButton>

              {props.onQuickAdd ? (
                <Tooltip title="Quick add 100g" placement="left" enterDelay={300}>
                  <span>
                    <IconButton
                      aria-label={`Quick add 100g of ${f.name}`}
                      disabled={quickAddPendingId === f.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setQuickAddErrorOpen(false);

                        try {
                          setQuickAddPendingId(f.id);
                          await props.onQuickAdd?.({ mealType: props.mealType, foodId: f.id, grams: 100 });

                          if (showQuickAddFeedback) {
                            setQuickAddSuccessMsg(`Added 100g of ${f.name}`);
                            setQuickAddSuccessOpen(true);
                          }
                        } catch {
                          setQuickAddErrorMsg(`Failed to add ${f.name}. Please try again.`);
                          setQuickAddErrorOpen(true);
                        } finally {
                          setQuickAddPendingId(null);
                        }
                      }}
                      sx={{ mr: 0.5 }}
                    >
                      {quickAddPendingId === f.id ? <CircularProgress size={18} /> : <AddIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
            </Box>
          ))}
        </List>
      </Box>

      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => props.onCreateFood(canCreateFromQuery ? query.trim() : undefined)}
      >
        Create food
      </Button>

      <Snackbar
        open={showQuickAddFeedback && quickAddSuccessOpen}
        autoHideDuration={1500}
        onClose={() => setQuickAddSuccessOpen(false)}
        message={quickAddSuccessMsg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

      <Snackbar
        open={quickAddErrorOpen}
        autoHideDuration={4000}
        onClose={() => setQuickAddErrorOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setQuickAddErrorOpen(false)}>
          {quickAddErrorMsg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
