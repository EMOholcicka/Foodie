# Phase 4 — Foods catalog + daily logging (backend + frontend)

This phase adds an end-to-end vertical slice for:

- A **food catalog** (global + per-user foods)
- **Daily meal logging** for a given date
- **Totals computation** per meal and per day

Frontend is implemented in [`apps/web`](apps/web:1) using React + Vite + TypeScript + MUI + React Query.

## Frontend UX flows (Phase 4)

### Routes

- **Today**: [`/today`](apps/web/src/features/days/routes/TodayRoute.tsx:1)
  - Shows consumed totals (kcal + P/C/F), and placeholders for remaining/targets (targets are Phase 5)
  - Shows meals preview (kcal per meal)
  - Primary CTA navigates to the Day view
- **Day view**: [`/day/:date`](apps/web/src/features/days/routes/DayRoute.tsx:1)
  - Date switcher (prev/next day)
  - Meal sections (breakfast/lunch/dinner/snack)
  - Per-meal subtotal row (kcal + macros)

### Food search → portion → add-to-meal

Flow is optimized for speed:

1. Open “Add” on a meal section (or “Add food” at the bottom)
2. Food picker dialog:
   - Search input is debounced (~250ms)
   - Tabs: Search / Recent / Favorites
     - Recent/Favorites are currently UI stubs (data plumbing is planned later)
3. Tap a result to open the **Food detail drawer**:
   - Shows macros per 100g
   - Portion picker:
     - grams input
     - quick presets: 50g / 100g / 200g
   - “Add to {meal}” CTA creates the entry

Key components:

- Picker: [`FoodSearchPanel`](apps/web/src/features/foods/components/FoodSearchPanel.tsx:1)
- Drawer: [`FoodDetailDrawer`](apps/web/src/features/foods/components/FoodDetailDrawer.tsx:1)

### Create food

From the picker (when search is empty or no results), user can create a food.

- Dialog: [`CreateFoodDialog`](apps/web/src/features/foods/components/CreateFoodDialog.tsx:1)
- Fields are per-100g
- UX validation includes a kcal “looks off” guardrail:
  - computed kcal = `protein*4 + carbs*4 + fat*9`
  - warn/error if mismatch > 30 kcal

Validation helper (unit-tested): [`validateCreateFood`](apps/web/src/features/foods/domain/foodValidation.ts:1)

### Logging + totals

- Entries are created via POST `/days/{date}/entries`
- Day and meal totals are displayed from API response
- Targets are not implemented in Phase 4; UI shows placeholders for remaining/targets

API clients (typed):

- Foods: [`foodsApi.ts`](apps/web/src/features/foods/api/foodsApi.ts:1)
- Days: [`daysApi.ts`](apps/web/src/features/days/api/daysApi.ts:1)

React Query integration:

- `useQuery` for day + food list
- `useMutation` for adding day entries and creating foods
- invalidation keys: `['day', date]` and `['foods']`

## Auth + scoping rules

All endpoints require a valid Bearer access token.

- All data is **user-scoped**.
- `foods` can be:
  - **Global**: `user_id = NULL` (visible to all users, immutable via user endpoints)
  - **User-owned**: `user_id = <current_user.id>` (visible only to the owner; mutable by the owner)

## Data model

### `foods`

A food defines macro-nutrients **per 100g**.

Fields (conceptual):

- `id` (UUID)
- `user_id` (UUID, nullable)
- `name` (string)
- `brand` (string, nullable)
- `kcal_100g`, `protein_100g`, `carbs_100g`, `fat_100g` (numeric)

Constraints / indexes:

- Uniqueness (brand treats `NULL` and `""` as the same):
  - Global scope: unique on `(name, coalesce(brand, ''))` where `user_id IS NULL`
  - User scope: unique on `(user_id, name, coalesce(brand, ''))` where `user_id IS NOT NULL`
- Search index over `lower(name)` and `lower(brand)`

### `days`

Represents a single calendar date for a user.

- `id` (UUID)
- `user_id` (UUID)
- `date` (date)

Constraint: unique `(user_id, date)`.

### `meal_entries`

One logged item inside a day, grouped into a meal.

- `id` (UUID)
- `day_id` (UUID)
- `meal_type`: one of `breakfast | lunch | dinner | snack`
- `food_id` (UUID, nullable)
- `recipe_id` (UUID, nullable; reserved for later)
- `grams` (numeric)
- optional `servings` / `serving_label` (reserved for UX later)

Validation:

- `grams > 0`
- optional `servings > 0` when provided
- exactly one of `food_id` or `recipe_id` must be set (XOR)

## Totals computation

### Entry totals

For an entry linked to a `food_id`:

- `factor = grams / 100`
- `kcal = factor * food.kcal_100g`
- `protein = factor * food.protein_100g`
- `carbs = factor * food.carbs_100g`
- `fat = factor * food.fat_100g`

### Meal totals

Meal totals are the sum of entry totals for the meal.

### Day totals

Day totals are the sum of meal totals across all meals.

### Rounding

API responses round totals to **2 decimals**.

## API

### Foods

#### POST `/foods`

Create a user-owned food.

Request body:

```json
{
  "name": "Chicken breast",
  "brand": null,
  "kcal_100g": 165,
  "protein_100g": 31,
  "carbs_100g": 0,
  "fat_100g": 3.6
}
```

Validation:

- `name` required
- macros are `>= 0`
- `protein_100g|carbs_100g|fat_100g <= 100`

Responses:

- `201` with created food
- `409` if `(user_id, name, brand)` already exists for this user

#### GET `/foods?query=`

Search foods visible to the user (global + user-owned).

Query params:

- `query` (optional): matches `name` or `brand` (case-insensitive)
- `limit` (optional, default 20)

Response:

```json
{
  "items": [
    {
      "id": "...",
      "owner": "global",
      "name": "Banana",
      "brand": null,
      "kcal_100g": 89,
      "protein_100g": 1.1,
      "carbs_100g": 22.8,
      "fat_100g": 0.3
    }
  ]
}
```

#### PUT `/foods/{id}`

Update a **user-owned** food.

Rules:

- If the food is global (`user_id = NULL`), the endpoint returns `404`.
- If the food belongs to another user, the endpoint returns `404`.

Responses:

- `200` with updated food
- `404` if not found in user-owned scope

### Days

#### POST `/days/{date}/entries`

Add one or more entries to the given day (creates the day row if missing).

`date` path param: ISO date (`YYYY-MM-DD`).

Request body: a JSON array of entry objects.

```json
[
  {
    "meal_type": "breakfast",
    "food_id": "<uuid>",
    "grams": 150
  },
  {
    "meal_type": "lunch",
    "food_id": "<uuid>",
    "grams": 200
  }
]
```

Validation:

- `meal_type` must be one of: `breakfast | lunch | dinner | snack`
- `grams > 0`
- exactly one of `food_id` or `recipe_id` must be set (recipes reserved; currently `recipe_id` must be null)
- food must exist and be visible to the current user (global or owned). Otherwise `404`.

Response (`201`):

```json
{
  "date": "2026-02-17",
  "added": [
    {
      "id": "...",
      "meal_type": "breakfast",
      "food": {
        "id": "...",
        "name": "Banana",
        "brand": null,
        "kcal_100g": 89,
        "protein_100g": 1.1,
        "carbs_100g": 22.8,
        "fat_100g": 0.3,
        "owner": "global"
      },
      "grams": 150,
      "macros": { "kcal": 133.5, "protein_g": 1.65, "carbs_g": 34.2, "fat_g": 0.45 }
    }
  ]
}
```

#### GET `/days/{date}`

Returns all meals for the day (even if empty) + per-meal totals + day totals.

Response (`200`):

```json
{
  "date": "2026-02-17",
  "meals": [
    {
      "meal_type": "breakfast",
      "entries": [],
      "totals": { "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }
    },
    {
      "meal_type": "lunch",
      "entries": [],
      "totals": { "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }
    },
    {
      "meal_type": "dinner",
      "entries": [],
      "totals": { "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }
    },
    {
      "meal_type": "snack",
      "entries": [],
      "totals": { "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }
    }
  ],
  "totals": { "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }
}
```

If the day does not exist yet, it still returns the empty structure above.

## UX implications (for upcoming frontend)

### Foods search

- Frontend should call `GET /foods?query=` as the user types.
- The backend search returns **global + user-owned** foods.
- Result items include `owner` so the UI can label global vs custom.

### Recent foods hook

Phase 4 does not yet provide a dedicated “recent foods” endpoint.

Suggested upcoming approach:

- Use `GET /days/{date}` (today) to extract foods used recently.
- Optionally add a future endpoint like `GET /foods/recent?limit=` that derives from `meal_entries`.

### Editing foods

- UI should only show an “Edit” action for foods where `owner == "user"`.
- Attempts to edit global foods return `404`.
