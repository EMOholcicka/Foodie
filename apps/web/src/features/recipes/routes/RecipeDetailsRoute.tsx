import EditIcon from "@mui/icons-material/Edit";
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { listFoods } from "../../foods/api/foodsApi";
import { useFoodsCache } from "../../foods/domain/foodsCache";
import { useRecipeQuery } from "../api/recipesQueries";

function formatKcal(n: number) {
  return `${Math.round(n)} kcal`;
}

function formatMacroG(n: number) {
  return `${Math.round(n)}g`;
}

export function RecipeDetailsRoute() {
  const navigate = useNavigate();
  const params = useParams();
  const recipeId = params.recipeId ?? "";

  const recipeQuery = useRecipeQuery(recipeId);
  const recipe = recipeQuery.data;

  const foodsCache = useFoodsCache();
  const [foodLookupSeeded, setFoodLookupSeeded] = useState(false);

  useEffect(() => {
    // Pragmatic: best-effort seed from what we can fetch without a by-ids endpoint.
    // If users have searched/picked foods in this session, cache will already have items.
    // Here we seed at least something for a nicer UI on details.
    if (foodLookupSeeded) return;
    if (!recipeQuery.isSuccess) return;
    const ids = new Set((recipe?.items ?? []).map((i) => i.food_id));
    if (ids.size === 0) {
      setFoodLookupSeeded(true);
      return;
    }

    void (async () => {
      try {
        // Lightweight heuristic: try searching by recipe name tokens to reuse server search.
        // This won't guarantee matches; rows/totals still depend on resolved foods.
        const tokens = (recipe?.name ?? "").split(/\s+/).map((t) => t.trim()).filter(Boolean).slice(0, 2);
        const results = await Promise.all(tokens.map((q) => listFoods({ query: q, limit: 50 })));
        foodsCache.seed(results.flat());
      } finally {
        setFoodLookupSeeded(true);
      }
    })();
  }, [foodLookupSeeded, foodsCache, recipe?.items, recipe?.name, recipeQuery.isSuccess]);

  const [scaleServings, setScaleServings] = useState("1");

  const scaled = useMemo(() => {
    const s = Math.max(1, Number(scaleServings) || 1);
    const perServing = recipe?.macros_per_serving;
    const total = perServing
      ? {
          kcal: perServing.kcal * s,
          protein: perServing.protein * s,
          carbs: perServing.carbs * s,
          fat: perServing.fat * s,
        }
      : null;

    return { servings: s, total };
  }, [recipe?.macros_per_serving, scaleServings]);

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="h5" component="h1">
            {recipe?.name ?? "Recipe"}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            disabled={!recipe}
            onClick={() => navigate(`/recipes/${recipeId}/edit`)}
          >
            Edit
          </Button>
        </Stack>

        {recipeQuery.isError ? <Alert severity="error">Failed to load recipe.</Alert> : null}

        {recipeQuery.isLoading ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading
            </Typography>
          </Stack>
        ) : null}

        {recipe ? (
          <Stack spacing={1} component="section" aria-label="Recipe macros">
            <Typography variant="body2" color="text.secondary">
              {recipe.servings} servings
            </Typography>

            <Typography variant="subtitle2">Per serving</Typography>
            <Typography variant="body1">
              {formatKcal(recipe.macros_per_serving.kcal)} • P {formatMacroG(recipe.macros_per_serving.protein)} • C{" "}
              {formatMacroG(recipe.macros_per_serving.carbs)} • F {formatMacroG(recipe.macros_per_serving.fat)}
            </Typography>

            <Divider sx={{ my: 1 }} />

            <TextField
              label="Scale to servings"
              value={scaleServings}
              onChange={(e) => setScaleServings(e.target.value)}
              inputMode="numeric"
            />

            {scaled.total ? (
              <Stack spacing={0.5} aria-label="Scaled totals">
                <Typography variant="subtitle2">Scaled total ({scaled.servings} servings)</Typography>
                <Typography variant="body2">
                  {formatKcal(scaled.total.kcal)} • P {formatMacroG(scaled.total.protein)} • C {formatMacroG(
                    scaled.total.carbs,
                  )} • F {formatMacroG(scaled.total.fat)}
                </Typography>
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        <Divider />

        <Stack spacing={1} component="section" aria-label="Ingredients">
          <Typography variant="h6" component="h2">
            Ingredients
          </Typography>
          <List disablePadding>
            {(recipe?.items ?? []).map((i) => {
              const food = foodsCache.get(i.food_id);
              const name = food?.name ?? "Unknown food";
              return (
                <ListItem key={i.id} divider>
                  <ListItemText primary={name} secondary={`${i.grams} g`} />
                </ListItem>
              );
            })}
          </List>
          {recipe && recipe.items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No ingredients.
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Container>
  );
}
