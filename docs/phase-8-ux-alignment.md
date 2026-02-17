# Phase 8 — Competitive UX alignment (desk research)

Goal: align Foodie UX with proven interaction patterns from leading nutrition/weight apps, while staying within Foodie’s current feature set.

Scope constraints (explicit exclusions): paywalls/subscriptions, social/community, coaching, device integrations.

Foodie routes in scope:
- [`apps/web/src/app/router.tsx`](apps/web/src/app/router.tsx:17)
  - `/auth`
  - `/today`
  - `/day/:date`
  - `/targets`
  - `/weight`
  - `/plan` and `/plan/grocery`
  - `/recipes`

---

## 1) Competitive pattern inventory (by UI pattern)

Apps reviewed (desk research): MyFitnessPal, Cronometer, LoseIt, MacroFactor, Lifesum, EatThisMuch.

### 1.1 Navigation model / information architecture

**Observed competitive patterns**
- **Bottom tab bar as primary navigation** with 4–6 top-level destinations. Common tabs: Diary/Log (today), Plan, Progress (weight), Goals/Targets, More.
- **Diary is the default landing** after login and remains the home for daily actions.
- **Secondary navigation inside a tab** uses segmented controls (Plan vs Grocery), sticky headers, or top tabs.
- **Fast add entry**: a single prominent CTA (+) that is context-aware (adds to active meal/day), often persistent as a FAB.
- **Date navigation is always present in Diary** (previous/next day + calendar picker).

**Implications for Foodie**
- Foodie already uses bottom navigation in [`AppShell`](apps/web/src/app/shell/AppShell.tsx:21) and defaults to `/today` in [`router`](apps/web/src/app/router.tsx:30). This is aligned.
- Foodie has strong day-to-day date stepping in [`DayRoute`](apps/web/src/features/days/routes/DayRoute.tsx:98), but lacks a calendar/date picker.
- Foodie’s “Add food” entry point is present, but not consistently “single primary CTA” across contexts.


### 1.2 Daily budget visualization patterns (kcal + macros)

**Observed competitive patterns**
- **Single hero budget component** on the diary screen:
  - Remaining kcal prominently, with consumed and goal as supporting text.
  - Visual progress via **ring** (donut) or **stacked bars**.
  - State changes when over budget (color + label changes).
- **Per-meal allocation summary** on the diary:
  - Meal rows show kcal per meal with quick add.
- **Macro breakdown**: either three mini bars (P/C/F) or a compact line; often collapsible.

**Implications for Foodie**
- Foodie’s [`RemainingTargetsCard`](apps/web/src/features/targets/components/RemainingTargetsCard.tsx:28) nails “Remaining vs Over by” copy and supports macro remaining.
- Foodie does **not** visualize progress (no ring/bar), only numeric.
- Foodie’s `/today` meal summary is text-only and requires entering `/day/:date` to add to a specific meal.


### 1.3 Food search patterns (recent/favorites/barcode)

**Observed competitive patterns**
- Search is designed as a **multi-source picker**:
  - Search results + **Recent** + **Favorites** (and sometimes “My foods”, “Recipes”).
  - **Barcode** entry is a first-class action near the search field.
  - Result rows show high-signal info (kcal, serving size, brand) and enable “quick add” or “details”.
- Query assistance:
  - Debounced search, minimal states, and clear empty state with “Create new food”.

**Implications for Foodie**
- Foodie already has tabs Search/Recent/Favorites in [`FoodSearchPanel`](apps/web/src/features/foods/components/FoodSearchPanel.tsx:30) and a strong “Create from query” empty state.
- Missing: barcode entry, quick add defaults, stronger “recent/favorites” data (tabs likely stubbed unless backed by API).


### 1.4 Weight trend visualization patterns

**Observed competitive patterns**
- Weight screens typically combine:
  - **Trend summary** (weekly change, rolling averages)
  - **Interactive chart** with range selectors (1w/1m/3m/1y)
  - **History list** with inline edit/delete and undo.
- Many apps show both **raw weigh-ins** and a **smoothed trend line** (MacroFactor is known for this).

**Implications for Foodie**
- Foodie already has:
  - Trend summary in [`TrendSummaryCard`](apps/web/src/features/weight/components/TrendSummaryCard.tsx:17)
  - Chart with range toggle and moving average in [`WeightChartCard`](apps/web/src/features/weight/components/WeightChartCard.tsx:25)
  - Undo delete and history table in [`WeightRoute`](apps/web/src/features/weight/routes/WeightRoute.tsx:72)
- Biggest gap vs competitors: accessibility semantics for chart (screen-reader summary), and “empty state first weigh-in” onboarding.


### 1.5 Weekly planning patterns

**Observed competitive patterns**
- Weekly plan screens typically include:
  - A **week overview** (grid/list) with daily totals.
  - A **day detail** view that drills into meals.
  - A “generate/fill week” experience with a compact set of inputs.
- In meal planning apps (EatThisMuch), the workflow emphasizes:
  - **Lock/swap meals**
  - **Grocery list** as a sibling view
  - Copy previous week / reuse patterns.

**Implications for Foodie**
- Foodie already implements:
  - Week grid + day drawer in [`WeeklyPlanRoute`](apps/web/src/features/plans/routes/WeeklyPlanRoute.tsx:264)
  - Grocery list sibling in [`GroceryListRoute`](apps/web/src/features/plans/routes/GroceryListRoute.tsx:91)
- Gaps:
  - Missing “copy last week” (icons exist but appear unused) and lock/swap UX (explicitly noted as coming soon).
  - No weekly totals (aggregate) or progress vs targets.

---

## 2) Recommended UX changes (tailored to current Foodie)

### 2.1 Onboarding / first-run

Competitors reduce time-to-first-success by making the first session: set goal → log first item → see remaining.

Recommended:
- Add a **first-run checklist** (targets set? first food logged? first weigh-in?) presented on `/today` until complete.
- Make “Set targets” and “Add food” CTAs more prominent when empty states are detected.

Relevant existing UI:
- Targets empty state already exists inside [`RemainingTargetsCard`](apps/web/src/features/targets/components/RemainingTargetsCard.tsx:50).


### 2.2 Diary (Today + Day) alignment

Recommended:
- Treat `/today` as the “Diary home”:
  - Show remaining card + meal breakdown + a single primary CTA.
- On `/day/:date`, add a lightweight **date picker** in addition to previous/next.
- Add a **budget visualization** (ring or bar) inside RemainingTargetsCard without adding new data sources.


### 2.3 Food search alignment

Recommended:
- Promote the picker to a consistent “Add food” flow:
  - Search/Recent/Favorites tabs remain, but add a “Scan barcode” affordance (can be stubbed UI-only until backend exists).
- Add “Quick add 100g” (or last used grams) directly from search result row, without opening details.


### 2.4 Weight screen alignment

Recommended:
- Add a clear “first weigh-in” empty state with a single CTA (opens AddWeighInDialog).
- Provide an accessible “chart summary” paragraph that communicates trend without requiring the chart.


### 2.5 Weekly plan alignment

Recommended:
- Add a compact weekly totals summary (kcal + macros) at top of `/plan`.
- Improve day drawer actions:
  - Primary: open grocery list
  - Secondary: jump to `/day/:date` for logging (bridges plan → diary)
- Add “Copy previous week” UX (button or menu) if API supports it; otherwise a placeholder ticket.

---

## 3) Actionable ticket backlog (prioritized)

Ticket format:
- **Priority**: P0 (must), P1 (should), P2 (nice)
- **Reference**: route + key component
- **Acceptance criteria**: observable UI/UX behavior

### P0 — Reduce friction in core daily logging

#### P0-1: Make `/today` a complete Diary home (meal rows become actionable)
- Reference: `/today` in [`TodayRoute`](apps/web/src/features/days/routes/TodayRoute.tsx:9), `/day/:date` in [`DayRoute`](apps/web/src/features/days/routes/DayRoute.tsx:34)
- Change:
  - On `/today`, for each meal row, provide an “Add” affordance that takes user directly to adding for that meal (either deep-link into `/day/:date` with a query param, or open the picker inline).
- Acceptance criteria:
  - From `/today`, user can add food to breakfast/lunch/dinner/snack with ≤ 2 taps.
  - Keyboard: meal actions are reachable and activatable via Tab + Enter/Space.

#### P0-2: Add budget visualization to remaining card (kcal + macros)
- Reference: [`RemainingTargetsCard`](apps/web/src/features/targets/components/RemainingTargetsCard.tsx:28)
- Change:
  - Add a visual progress indicator for kcal (and optionally macros) using existing target + consumed totals.
- Acceptance criteria:
  - Shows progress state for kcal at minimum.
  - Over-budget state is visually distinct and not color-only (text label remains Over by).
  - Screen reader announces remaining/over-by via existing aria-labels plus a concise progress summary.

#### P0-3: Food search tabs must reflect real data or be clearly labeled as empty
- Reference: [`FoodSearchPanel`](apps/web/src/features/foods/components/FoodSearchPanel.tsx:37)
- Change:
  - If “Recent”/“Favorites” are not backed by API yet, show an explicit empty state explaining how they will populate (e.g., recent after adding foods; favorites after starring).
- Acceptance criteria:
  - No silent blank lists; each empty tab has a helpful message + next action.


### P1 — Competitive polish and cross-flow cohesion

#### P1-1: Add calendar/date picker entry on `/day/:date`
- Reference: [`DayRoute`](apps/web/src/features/days/routes/DayRoute.tsx:98)
- Acceptance criteria:
  - User can jump to any date without repeated next/previous clicks.
  - Works with keyboard and has an accessible label.

#### P1-2: Add Quick Add from food search results
- Reference: [`FoodSearchPanel`](apps/web/src/features/foods/components/FoodSearchPanel.tsx:135), [`FoodDetailDrawer`](apps/web/src/features/foods/components/FoodDetailDrawer.tsx:39)
- Change:
  - Each result row offers a secondary action to add a default portion (e.g., 100g) to the active meal.
- Acceptance criteria:
  - Quick-add does not block existing detail flow.
  - On success, day totals update.

#### P1-3: Weight chart accessibility summary
- Reference: [`WeightChartCard`](apps/web/src/features/weight/components/WeightChartCard.tsx:25)
- Change:
  - Provide a text summary of the selected range: last weigh-in, moving average, net change.
- Acceptance criteria:
  - Summary updates when range toggles.
  - Chart remains usable, but core information is available without it.

#### P1-4: Plan → Diary bridge actions
- Reference: [`WeeklyPlanRoute`](apps/web/src/features/plans/routes/WeeklyPlanRoute.tsx:431)
- Change:
  - In day drawer, add CTA: “Open day log” linking to `/day/:date`.
- Acceptance criteria:
  - From weekly plan, user can jump to the selected day’s logging screen.


### P2 — Nice-to-have parity patterns

#### P2-1: Barcode scan entry point (UI stub)
- Reference: [`FoodSearchPanel`](apps/web/src/features/foods/components/FoodSearchPanel.tsx:76)
- Change:
  - Add “Scan barcode” button near search field; if not supported, show dialog explaining not yet available.
- Acceptance criteria:
  - Button is present and accessible.
  - No broken flows; users are guided.

#### P2-2: Weekly totals summary on `/plan`
- Reference: [`WeeklyPlanRoute`](apps/web/src/features/plans/routes/WeeklyPlanRoute.tsx:203)
- Change:
  - Aggregate week kcal/macros from plan days and display near week label.
- Acceptance criteria:
  - Totals update with week navigation.
  - Handles missing plan gracefully.

#### P2-3: Copy previous week (if API supports)
- Reference: icons present in plan routes (e.g., [`WeeklyPlanRoute`](apps/web/src/features/plans/routes/WeeklyPlanRoute.tsx:3))
- Acceptance criteria:
  - User can duplicate prior week into current selection, with confirmation.

---

## 4) Accessibility baseline (must-haves)

Applies to all tickets above.

### Navigation + structure
- Each route has a single clear page heading (`h1`/`h2` via Typography semantics).
- Bottom navigation labels are present (already `showLabels` in [`AppShell`](apps/web/src/app/shell/AppShell.tsx:84)).

### Forms and dialogs/drawers
- All inputs have visible labels (already true across Auth/Targets/Food detail).
- Dialogs/drawers:
  - Ensure focus is trapped and initial focus is sensible (MUI defaults help, but verify).
  - Provide close button with `aria-label` (Food detail drawer already does this in [`FoodDetailDrawer`](apps/web/src/features/foods/components/FoodDetailDrawer.tsx:95)).

### Non-color cues
- Over/remaining states must not rely only on color (Foodie uses text labels already in [`RemainingTargetsCard`](apps/web/src/features/targets/components/RemainingTargetsCard.tsx:16)).

### Charts
- Provide textual summaries and/or tables for users who cannot perceive charts.
- Tooltips are not the only way to access values.

### Touch targets
- Ensure primary actions meet minimum target size; avoid tiny icon-only controls without labels.

---

## Appendix: Current UX snapshot (Foodie)

- Primary navigation: Bottom tab bar in [`AppShell`](apps/web/src/app/shell/AppShell.tsx:21)
- Diary:
  - `/today`: summary + Remaining card + Open day button in [`TodayRoute`](apps/web/src/features/days/routes/TodayRoute.tsx:9)
  - `/day/:date`: meal sections + add food dialog flow in [`DayRoute`](apps/web/src/features/days/routes/DayRoute.tsx:34)
- Food picker: tabs + create flow in [`FoodSearchPanel`](apps/web/src/features/foods/components/FoodSearchPanel.tsx:37)
- Targets: editable in [`TargetsRoute`](apps/web/src/features/targets/routes/TargetsRoute.tsx:71)
- Weight: trend + chart + history in [`WeightRoute`](apps/web/src/features/weight/routes/WeightRoute.tsx:38)
- Weekly plan + grocery: [`WeeklyPlanRoute`](apps/web/src/features/plans/routes/WeeklyPlanRoute.tsx:119), [`GroceryListRoute`](apps/web/src/features/plans/routes/GroceryListRoute.tsx:91)
- Recipes list: [`RecipesListRoute`](apps/web/src/features/recipes/routes/RecipesListRoute.tsx:30)
