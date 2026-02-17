import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listFoods, type Food } from "../api/foodsApi";
import { useDebouncedValue } from "../domain/useDebouncedValue";

export type FoodSearchPanelProps = {
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  onPickFood: (food: Food) => void;
  onCreateFood: (initialName?: string) => void;
};

const FOOD_TABS = ["search", "recent", "favorites"] as const;
type FoodTab = (typeof FOOD_TABS)[number];

function isFoodTab(v: unknown): v is FoodTab {
  return typeof v === "string" && (FOOD_TABS as readonly string[]).includes(v);
}

export function FoodSearchPanel(props: FoodSearchPanelProps) {
  const [tab, setTab] = useState<FoodTab>("search");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);

  const searchTerm = debounced.trim();
  const searchEnabled = tab === "search" && searchTerm.length >= 2;

  const foodsQuery = useQuery({
    queryKey: ["foods", "search", searchTerm],
    queryFn: () => listFoods({ query: searchTerm, limit: 20 }),
    enabled: searchEnabled,
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
      >
        <Tab value="search" label="Search" />
        <Tab value="recent" label="Recent" />
        <Tab value="favorites" label="Favorites" />
      </Tabs>

      <TextField
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

        {searchEnabled && foodsQuery.isLoading ? (
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

        <List dense disablePadding>
          {items.map((f) => (
            <ListItemButton key={f.id} onClick={() => props.onPickFood(f)}>
              <ListItemText primary={f.name} secondary={f.brand ? `${f.brand} • ${f.owner}` : f.owner} />
              <Typography variant="body2" color="text.secondary">
                {Math.round(f.kcal_100g)} kcal
              </Typography>
            </ListItemButton>
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
    </Stack>
  );
}
