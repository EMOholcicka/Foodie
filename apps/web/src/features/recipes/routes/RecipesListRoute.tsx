import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useRecipesListQuery } from "../api/recipesQueries";

function formatMacrosLine(kcal: number, p: number, c: number, f: number) {
  const kcalRounded = Math.round(kcal);
  const pRounded = Math.round(p);
  const cRounded = Math.round(c);
  const fRounded = Math.round(f);
  return `${kcalRounded} kcal • P ${pRounded}g • C ${cRounded}g • F ${fRounded}g`;
}

export function RecipesListRoute() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const recipesQuery = useRecipesListQuery();

  const filtered = useMemo(() => {
    // Defensive: in some environments the query data can be a wrapped object
    // (e.g. `{ items: [...] }`) due to API response shape mismatch.
    const raw: any = recipesQuery.data;
    const items = Array.isArray(raw) ? raw : (raw?.items ?? []);

    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r: any) => String(r.name ?? "").toLowerCase().includes(q));
  }, [query, recipesQuery.data]);

  const showEmptyState =
    recipesQuery.isSuccess &&
    ((Array.isArray(recipesQuery.data)
      ? recipesQuery.data.length
      : (recipesQuery.data as any)?.items?.length) ??
      0) === 0;

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="h5" component="h1">
            Recipes
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/recipes/new")}>
            New
          </Button>
        </Stack>

        <TextField
          label="Search recipes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputProps={{ "aria-label": "Search recipes" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Box>
          {recipesQuery.isError ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => recipesQuery.refetch()}>
                  Retry
                </Button>
              }
            >
              Failed to load recipes.
            </Alert>
          ) : null}

          {recipesQuery.isLoading ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading
              </Typography>
            </Stack>
          ) : null}

          {showEmptyState ? (
            <Stack spacing={1} sx={{ py: 2 }}>
              <Typography variant="body1">No recipes yet.</Typography>
              <Typography variant="body2" color="text.secondary">
                Create your first recipe to quickly track meals.
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => navigate("/recipes/new")}>
                Create a recipe
              </Button>
            </Stack>
          ) : null}

          {!showEmptyState && recipesQuery.isSuccess ? (
            <List disablePadding>
              {filtered.map((r) => (
                <ListItemButton key={r.id} onClick={() => navigate(`/recipes/${r.id}`)}>
                  <ListItemText
                    primary={r.name}
                    secondary={
                      <span>
                        {`${r.servings} servings • `}
                        {formatMacrosLine(
                          r.macros_per_serving.kcal,
                          r.macros_per_serving.protein,
                          r.macros_per_serving.carbs,
                          r.macros_per_serving.fat,
                        )}
                      </span>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          ) : null}
        </Box>
      </Stack>
    </Container>
  );
}
