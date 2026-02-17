import AddIcon from "@mui/icons-material/Add";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useRecipesListQuery, useToggleRecipeFavoriteMutation } from "../api/recipesQueries";

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
  const [highProtein, setHighProtein] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | "">("");

  const recipesQuery = useRecipesListQuery({
    high_protein: highProtein,
    favorites_only: favoritesOnly,
    tags: tagFilter ? [tagFilter] : undefined,
  });

  const filtered = useMemo(() => {
    // Keep client-side search only; other filters are server-side.
    const raw: any = recipesQuery.data;
    const items = Array.isArray(raw) ? raw : (raw?.items ?? []);

    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r: any) => String(r.name ?? "").toLowerCase().includes(q));
  }, [query, recipesQuery.data]);

  const allTags = useMemo(() => {
    const raw: any = recipesQuery.data;
    const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
    const s = new Set<string>();
    for (const r of items) {
      for (const t of r.tags ?? []) s.add(String(t));
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [recipesQuery.data]);

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

        <Stack spacing={1}>
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

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" aria-label="Recipe filters">
            <Chip
              label="High protein"
              color={highProtein ? "primary" : "default"}
              variant={highProtein ? "filled" : "outlined"}
              clickable
              onClick={() => setHighProtein((v) => !v)}
              aria-pressed={highProtein}
            />
            <Chip
              label="Favorites"
              color={favoritesOnly ? "primary" : "default"}
              variant={favoritesOnly ? "filled" : "outlined"}
              clickable
              onClick={() => setFavoritesOnly((v) => !v)}
              aria-pressed={favoritesOnly}
            />

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="recipe-tag-filter-label">Tag</InputLabel>
              <Select
                labelId="recipe-tag-filter-label"
                label="Tag"
                value={tagFilter}
                onChange={(e) => setTagFilter(String(e.target.value))}
                displayEmpty
                inputProps={{ "aria-label": "Filter by tag" }}
              >
                <MenuItem value="">
                  <em>All tags</em>
                </MenuItem>
                {allTags.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>

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
                <RecipeRow
                  key={r.id}
                  recipe={r}
                  onOpen={() => navigate(`/recipes/${r.id}`)}
                />
              ))}
            </List>
          ) : null}
        </Box>
      </Stack>
    </Container>
  );
}

function RecipeRow({ recipe, onOpen }: { recipe: any; onOpen: () => void }) {
  const toggleFav = useToggleRecipeFavoriteMutation(recipe.id);

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <IconButton
          edge="end"
          aria-label={recipe.is_favorite ? "Unpin recipe" : "Pin recipe"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFav.mutate(Boolean(recipe.is_favorite));
          }}
          disabled={toggleFav.isPending}
        >
          {recipe.is_favorite ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
        </IconButton>
      }
    >
      <ListItemButton onClick={onOpen}>
        <ListItemText
          primary={recipe.name}
          secondary={
            <span>
              {`${recipe.servings} servings • `}
              {formatMacrosLine(
                recipe.macros_per_serving.kcal,
                recipe.macros_per_serving.protein,
                recipe.macros_per_serving.carbs,
                recipe.macros_per_serving.fat,
              )}
              {recipe.tags?.length ? ` • ${recipe.tags.join(", ")}` : ""}
            </span>
          }
        />
      </ListItemButton>
    </ListItem>
  );
}
