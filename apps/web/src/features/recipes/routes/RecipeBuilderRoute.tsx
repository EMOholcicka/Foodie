import DeleteIcon from "@mui/icons-material/Delete";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { listFoods, type Food } from "../../foods/api/foodsApi";
import { CreateFoodDialog } from "../../foods/components/CreateFoodDialog";
import { FoodSearchPanel } from "../../foods/components/FoodSearchPanel";
import { useFoodsCache } from "../../foods/domain/foodsCache";
import { useDebouncedValue } from "../../foods/domain/useDebouncedValue";
import {
  useAddRecipeItemMutation,
  useCreateRecipeMutation,
  useDeleteRecipeItemMutation,
  useRecipeQuery,
  useUpdateRecipeItemMutation,
  useUpdateRecipeMutation,
} from "../api/recipesQueries";
import { computeFoodMacrosForGrams, computeRecipeFromItems, type RecipeItemWithFood } from "../domain/recipeMath";

type ValidatedNumber = { ok: true; value: number } | { ok: false; reason: string };

function formatKcal(n: number) {
  return `${Math.round(n)} kcal`;
}

function formatMacroG(n: number) {
  return `${Math.round(n)}g`;
}

function parseValidGrams(raw: string): ValidatedNumber {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "Required" };
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return { ok: false, reason: "Must be a number" };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, reason: "Must be a number" };
  if (n < 1) return { ok: false, reason: "Must be ≥ 1" };
  if (n > 5000) return { ok: false, reason: "Must be ≤ 5000" };
  return { ok: true, value: n };
}

function parseValidServings(raw: string): ValidatedNumber {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "Required" };
  if (!/^\d+$/.test(trimmed)) return { ok: false, reason: "Must be a whole number" };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, reason: "Must be a number" };
  if (n < 1) return { ok: false, reason: "Must be ≥ 1" };
  if (n > 1000) return { ok: false, reason: "Must be ≤ 1000" };
  return { ok: true, value: n };
}

export function RecipeBuilderRoute() {
  const navigate = useNavigate();
  const params = useParams();
  const recipeId = params.recipeId;
  const isNew = !recipeId || recipeId === "new";

  const recipeQuery = useRecipeQuery(!isNew && recipeId ? recipeId : "");

  const createRecipe = useCreateRecipeMutation();
  const updateRecipe = useUpdateRecipeMutation(!isNew && recipeId ? recipeId : "");

  const addItem = useAddRecipeItemMutation(!isNew && recipeId ? recipeId : "");
  const updateItem = useUpdateRecipeItemMutation(!isNew && recipeId ? recipeId : "");
  const deleteItem = useDeleteRecipeItemMutation(!isNew && recipeId ? recipeId : "");

  const [name, setName] = useState("");
  const [servings, setServings] = useState("2");
  const [servingsError, setServingsError] = useState<string | undefined>(undefined);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [createFoodOpen, setCreateFoodOpen] = useState(false);
  const [createFoodInitialName, setCreateFoodInitialName] = useState<string | undefined>(undefined);

  const foodsCache = useFoodsCache();

  const [foodQuery, setFoodQuery] = useState("");
  const debouncedFoodQuery = useDebouncedValue(foodQuery, 250);
  const foodsQuery = useQuery({
    queryKey: ["foods", "search", "recipe-builder", debouncedFoodQuery.trim()],
    queryFn: () => listFoods({ query: debouncedFoodQuery.trim(), limit: 50 }),
    enabled: debouncedFoodQuery.trim().length >= 2,
    retry: false,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (foodsQuery.data?.length) foodsCache.seed(foodsQuery.data);
  }, [foodsCache, foodsQuery.data]);

  const recipe = recipeQuery.data;

  // Initialize fields once when recipe loads.
  const [initializedFromServer, setInitializedFromServer] = useState(false);
  useEffect(() => {
    if (isNew) return;
    if (!recipeId) return;
    if (!recipeQuery.isSuccess) return;
    if (!recipe) return;
    if (initializedFromServer) return;

    setInitializedFromServer(true);
    setName(recipe.name);
    setServings(String(recipe.servings));
  }, [initializedFromServer, isNew, recipe, recipeId, recipeQuery.isSuccess]);

  const parsedServings = useMemo(() => parseValidServings(servings), [servings]);
  const servingsNum = parsedServings.ok ? parsedServings.value : 1;

  const [gramsByItemId, setGramsByItemId] = useState<Record<string, string>>({});
  const [gramsErrorByItemId, setGramsErrorByItemId] = useState<Record<string, string | undefined>>({});
  const [lastSavedAtByItemId, setLastSavedAtByItemId] = useState<Record<string, number>>({});
  const [dirtyItemIds, setDirtyItemIds] = useState<Set<string>>(() => new Set());

  // Track focus (editing) AND dirty/inFlight items to prevent server refetch from clobbering user input.
  const editingItemIdsRef = useRef<Set<string>>(new Set());
  const dirtyOrInFlightItemIdsRef = useRef<Set<string>>(new Set());
  // Synchronous per-item in-flight guard for rapid successive events (Enter then blur).
  const savingItemIdsRef = useRef<Set<string>>(new Set());

  const [saveFailedSnackbarOpen, setSaveFailedSnackbarOpen] = useState(false);
  const [deleteFailedSnackbarOpen, setDeleteFailedSnackbarOpen] = useState(false);

  useEffect(() => {
    const serverItems = recipe?.items ?? [];
    if (serverItems.length === 0) return;

    setGramsByItemId((prev) => {
      const next = { ...prev };
      for (const i of serverItems) {
        // Don't clobber active user edits.
        if (editingItemIdsRef.current.has(i.id)) continue;
        // Don't clobber values while a save is in-flight or after a failed save (dirty).
        if (dirtyOrInFlightItemIdsRef.current.has(i.id)) continue;
        if (next[i.id] === undefined) next[i.id] = String(i.grams);
      }
      return next;
    });
  }, [recipe?.items]);

  const unresolvedCount = useMemo(() => {
    const items = recipe?.items ?? [];
    let count = 0;
    for (const i of items) {
      if (!foodsCache.get(i.food_id)) count += 1;
    }
    return count;
  }, [foodsCache, recipe?.items]);

  const totalsIncompleteText = useMemo(() => {
    if (unresolvedCount <= 0) return null;
    const noun = unresolvedCount === 1 ? "ingredient" : "ingredients";
    return `Totals incomplete (${unresolvedCount} ${noun} unresolved)`;
  }, [unresolvedCount]);

  const itemsWithFood: RecipeItemWithFood[] = useMemo(() => {
    const items = recipe?.items ?? [];
    return items
      .map((i) => {
        const food = foodsCache.get(i.food_id);
        if (!food) return null;
        return { ...i, food };
      })
      .filter((x): x is RecipeItemWithFood => x !== null);
  }, [foodsCache, recipe?.items]);

  const computed = useMemo(() => computeRecipeFromItems(itemsWithFood, servingsNum), [itemsWithFood, servingsNum]);

  const canSaveMeta = name.trim().length > 0 && parsedServings.ok;

  const [savedSnackbarOpen, setSavedSnackbarOpen] = useState(false);

  const [savingItemIds, setSavingItemIds] = useState<Set<string>>(() => new Set());

  function commitGrams(itemId: string, raw: string) {
    // Per-item guard: prevent duplicate in-flight commits (e.g. Enter then blur).
    if (savingItemIdsRef.current.has(itemId)) return;

    const parsed = parseValidGrams(raw);
    if (!parsed.ok) {
      setGramsErrorByItemId((prev) => ({ ...prev, [itemId]: parsed.reason }));
      dirtyOrInFlightItemIdsRef.current.add(itemId);
      setDirtyItemIds((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
      return;
    }

    setGramsErrorByItemId((prev) => ({ ...prev, [itemId]: undefined }));
    dirtyOrInFlightItemIdsRef.current.add(itemId);

    // Keep showing an unsaved/dirty state until the save succeeds.
    setDirtyItemIds((prev) => {
      if (prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    savingItemIdsRef.current.add(itemId);
    setSavingItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    updateItem.mutate(
      { itemId, payload: { grams: parsed.value } },
      {
        onSuccess: () => {
          savingItemIdsRef.current.delete(itemId);
          dirtyOrInFlightItemIdsRef.current.delete(itemId);
          setSavingItemIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          setDirtyItemIds((prev) => {
            if (!prev.has(itemId)) return prev;
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          setLastSavedAtByItemId((prev) => ({ ...prev, [itemId]: Date.now() }));
          setSavedSnackbarOpen(true);
        },
        onError: () => {
          savingItemIdsRef.current.delete(itemId);
          setSavingItemIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          // Keep dirty flag set so refetch doesn't overwrite the user's value.
          setDirtyItemIds((prev) => {
            const next = new Set(prev);
            next.add(itemId);
            return next;
          });
          setSaveFailedSnackbarOpen(true);
        },
      },
    );
  }

  async function handleSaveMeta() {
    const parsed = parseValidServings(servings);
    if (!parsed.ok) {
      setServingsError(parsed.reason);
      return;
    }

    setServingsError(undefined);
    const payload = { name: name.trim(), servings: parsed.value };
    if (isNew) {
      const res = await createRecipe.mutateAsync(payload);
      navigate(`/recipes/${res.id}/edit`, { replace: true });
      setPickerOpen(true);
      return;
    }
    if (!recipeId) return;
    await updateRecipe.mutateAsync(payload);
  }

  async function handlePickFood(food: Food) {
    foodsCache.seed([food]);
    if (!recipeId || isNew) return;
    await addItem.mutateAsync({ food_id: food.id, grams: 100 });
    setPickerOpen(false);
  }

  return (
    <Container maxWidth="md" sx={{ py: 2, pb: 10 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2}>
          <Typography variant="h5" component="h1">
            {isNew ? "New recipe" : "Edit recipe"}
          </Typography>
          <Button variant="text" onClick={() => navigate("/recipes")}>Back</Button>
        </Stack>

        {!isNew && recipeQuery.isError ? (
          <Alert severity="error">Failed to load recipe.</Alert>
        ) : null}

        {!isNew && recipeQuery.isLoading ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading
            </Typography>
          </Stack>
        ) : null}

        <Stack spacing={2} component="section" aria-label="Recipe meta">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="Servings"
            value={servings}
            onChange={(e) => {
              setServings(e.target.value);
              setServingsError(undefined);
            }}
            inputMode="numeric"
            error={Boolean(servingsError)}
            helperText={servingsError ?? " "}
            onBlur={() => {
              const parsed = parseValidServings(servings);
              setServingsError(parsed.ok ? undefined : parsed.reason);
            }}
          />
          <Button
            variant="contained"
            onClick={handleSaveMeta}
            disabled={!canSaveMeta || createRecipe.isPending || updateRecipe.isPending}
          >
            {isNew ? "Save" : "Save"}
          </Button>
        </Stack>

        <Divider />

        <Stack spacing={1} direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="h2">
            Ingredients
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              if (isNew) return;
              setPickerOpen(true);
            }}
            disabled={isNew}
          >
            Add ingredient
          </Button>
        </Stack>

        {isNew ? (
          <Alert severity="info">Create the recipe first, then add ingredients.</Alert>
        ) : null}

        <List aria-label="Recipe ingredients">
          {(recipe?.items ?? []).map((item) => {
            const food = foodsCache.get(item.food_id);
            const gramsValue = gramsByItemId[item.id] ?? String(item.grams);
            const parsedGrams = parseValidGrams(gramsValue);
            const gramsNum = parsedGrams.ok ? parsedGrams.value : 0;
            const rowMacros = food && parsedGrams.ok ? computeFoodMacrosForGrams(food, gramsNum) : null;
            const gramsError = gramsErrorByItemId[item.id];
            const isEditing = editingItemIdsRef.current.has(item.id);
            const isSaving = savingItemIds.has(item.id);
            const isDirty = dirtyItemIds.has(item.id);
            const savedAt = lastSavedAtByItemId[item.id];

            return (
              <ListItem
                key={item.id}
                divider
                secondaryAction={
                  <IconButton
                    aria-label={`Remove ingredient ${food ? food.name : item.food_id}`}
                    edge="end"
                    onClick={() =>
                      deleteItem.mutate(item.id, {
                        onError: () => {
                          setDeleteFailedSnackbarOpen(true);
                        },
                      })
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <Stack spacing={1} sx={{ width: "100%" }}>
                  <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={2}>
                    <ListItemText
                      primary={food ? food.name : `Food ${item.food_id}`}
                      secondary={
                        rowMacros
                          ? `${formatKcal(rowMacros.kcal)} • P ${formatMacroG(rowMacros.protein)} • C ${formatMacroG(
                              rowMacros.carbs,
                            )} • F ${formatMacroG(rowMacros.fat)}`
                          : "Macros unavailable until food is resolved"
                      }
                    />
                    {!isEditing && !gramsError && isSaving ? (
                      <Typography variant="caption" color="text.secondary" aria-label="Grams saving indicator">
                        Saving…
                      </Typography>
                    ) : null}
                    {!isEditing && !gramsError && !isSaving && isDirty ? (
                      <Typography variant="caption" color="text.secondary" aria-label="Grams dirty indicator">
                        Unsaved
                      </Typography>
                    ) : null}
                    {!isEditing && !gramsError && !isDirty && !isSaving && savedAt ? (
                      <Typography variant="caption" color="text.secondary" aria-label="Grams saved indicator">
                        Saved
                      </Typography>
                    ) : null}
                  </Stack>

                  <TextField
                    label="Grams"
                    value={gramsValue}
                    inputMode="decimal"
                    error={Boolean(gramsError)}
                    helperText={gramsError ?? " "}
                    disabled={isSaving}
                    slotProps={{
                      input: {
                        endAdornment: isSaving ? (
                          <InputAdornment position="end">
                            <CircularProgress size={16} aria-label="Saving grams" />
                          </InputAdornment>
                        ) : undefined,
                      },
                    }}
                    onFocus={() => {
                      editingItemIdsRef.current.add(item.id);
                    }}
                    onChange={(e) => {
                      const next = e.target.value;
                      setGramsByItemId((prev) => ({ ...prev, [item.id]: next }));
                      setGramsErrorByItemId((prev) => ({ ...prev, [item.id]: undefined }));
                      dirtyOrInFlightItemIdsRef.current.add(item.id);
                      setDirtyItemIds((prev) => {
                        const nextSet = new Set(prev);
                        nextSet.add(item.id);
                        return nextSet;
                      });
                      // Clear stale saved indicator on any subsequent edit.
                      setLastSavedAtByItemId((prev) => {
                        if (prev[item.id] === undefined) return prev;
                        const nextMap = { ...prev };
                        delete nextMap[item.id];
                        return nextMap;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitGrams(item.id, gramsValue);
                      }
                    }}
                    onBlur={() => {
                      editingItemIdsRef.current.delete(item.id);
                      commitGrams(item.id, gramsValue);
                    }}
                  />
                </Stack>
              </ListItem>
            );
          })}
        </List>

        <Drawer anchor="bottom" open={pickerOpen} onClose={() => setPickerOpen(false)}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
              Add ingredient
            </Typography>
            <TextField
              label="Search foods"
              value={foodQuery}
              onChange={(e) => setFoodQuery(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
            <FoodSearchPanel
              mealType="lunch"
              onPickFood={handlePickFood}
              onCreateFood={(initialName) => {
                setCreateFoodInitialName(initialName);
                setCreateFoodOpen(true);
              }}
            />
          </Box>
        </Drawer>

        <CreateFoodDialog
          open={createFoodOpen}
          initialName={createFoodInitialName}
          onClose={() => setCreateFoodOpen(false)}
          onCreated={(food) => {
            setCreateFoodOpen(false);
            handlePickFood(food);
          }}
        />
      </Stack>

      <Box
        role="contentinfo"
        aria-label="Recipe totals"
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 56,
          bgcolor: "background.paper",
          borderTop: (t) => `1px solid ${t.palette.divider}`,
          py: 1,
        }}
      >
        <Container maxWidth="md">
          <Stack spacing={1}>
            {totalsIncompleteText ? (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                {totalsIncompleteText}
              </Alert>
            ) : null}
            <Stack direction="row" justifyContent="space-between" spacing={2}>
              <Stack>
                <Typography variant="caption" color="text.secondary">
                  Total
                </Typography>
                <Typography variant="body2" color={unresolvedCount > 0 ? "text.secondary" : undefined}>
                  {unresolvedCount > 0
                    ? "—"
                    : `${formatKcal(computed.total.kcal)} • P ${formatMacroG(computed.total.protein)} • C ${formatMacroG(
                        computed.total.carbs,
                      )} • F ${formatMacroG(computed.total.fat)}`}
                </Typography>
              </Stack>
              <Stack>
                <Typography variant="caption" color="text.secondary">
                  Per serving
                </Typography>
                <Typography variant="body2" color={unresolvedCount > 0 ? "text.secondary" : undefined}>
                  {unresolvedCount > 0
                    ? "—"
                    : `${formatKcal(computed.perServing.kcal)} • P ${formatMacroG(
                        computed.perServing.protein,
                      )} • C ${formatMacroG(computed.perServing.carbs)} • F ${formatMacroG(
                        computed.perServing.fat,
                      )}`}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Snackbar
        open={savedSnackbarOpen}
        autoHideDuration={1500}
        onClose={() => setSavedSnackbarOpen(false)}
        message="Saved"
      />

      <Snackbar open={saveFailedSnackbarOpen} autoHideDuration={2500} onClose={() => setSaveFailedSnackbarOpen(false)}>
        <Alert severity="error" variant="filled">
          Save failed
        </Alert>
      </Snackbar>

      <Snackbar
        open={deleteFailedSnackbarOpen}
        autoHideDuration={2500}
        onClose={() => setDeleteFailedSnackbarOpen(false)}
      >
        <Alert severity="error" variant="filled">
          Delete failed
        </Alert>
      </Snackbar>
    </Container>
  );
}
