# Foodie — Full implementation plan (Docker-first)

## Product goals
- Food tracking and planning app.
- Recomposition focus: fat loss while supporting muscle gain for strength + running.
- Fully runnable in Docker (dev + prod-like).

## Success criteria (definition of done)
- New user can sign up, set targets, log meals, log weight, view trends.
- User can generate a 7-day meal plan from templates, see daily totals, and export an aggregated grocery list.
- `docker compose up` starts the entire stack (frontend, API, DB) with persistent DB storage.

---

## Phase 0 — Decisions and guardrails
- [ ] Confirm primary stack: React + Vite + TS (frontend), FastAPI (backend), Postgres (DB), Docker Compose.
- [ ] Confirm units and localization defaults: kcal, grams, kg, timezone handling, Czech/English localization requirements.
- [ ] Confirm nutrition calculation rules:
  - macros stored per 100g for foods
  - recipe macros computed from ingredients
  - daily totals computed from entries
- [ ] Confirm training day types to support initially: lift, run, rest.

---

## Phase 1 — Repo structure + Docker skeleton
### Repository layout
- [ ] Create folders:
  - [ ] `apps/web/`
  - [ ] `apps/api/`
  - [ ] `infra/nginx/`
  - [ ] `infra/db/`
  - [ ] `docs/`

### Docker artifacts
- [ ] Add API [`apps/api/Dockerfile`](apps/api/Dockerfile:1)
- [ ] Add Web [`apps/web/Dockerfile`](apps/web/Dockerfile:1)
- [ ] Add Nginx config [`infra/nginx/nginx.conf`](infra/nginx/nginx.conf:1)
- [ ] Add compose for dev [`docker-compose.yml`](docker-compose.yml:1)
- [ ] Add compose for prod-like [`docker-compose.prod.yml`](docker-compose.prod.yml:1)

### Compose requirements
- [ ] Services: `db`, `api`, `web` (optional later: `redis`, `worker`)
- [ ] Named volume for Postgres data
- [ ] Healthchecks for `db` and `api`
- [ ] Environment variable template file [`env.example`](env.example:1)

---

## Phase 2 — Backend foundation (FastAPI)
### App scaffolding
- [ ] Create FastAPI app entrypoint [`apps/api/app/main.py`](apps/api/app/main.py:1)
- [ ] Settings management (env-based) [`apps/api/app/core/settings.py`](apps/api/app/core/settings.py:1)
- [ ] Structured logging setup [`apps/api/app/core/logging.py`](apps/api/app/core/logging.py:1)
- [ ] Health endpoint [`apps/api/app/routes/health.py`](apps/api/app/routes/health.py:1)

### Database + migrations
- [ ] SQLAlchemy engine/session [`apps/api/app/db/session.py`](apps/api/app/db/session.py:1)
- [ ] Alembic config + versions folder [`apps/api/alembic.ini`](apps/api/alembic.ini:1)
- [ ] Initial migration for core tables

### Auth (MVP)
- [ ] User model + migration [`apps/api/app/models/user.py`](apps/api/app/models/user.py:1)
- [ ] Password hashing (Argon2 or bcrypt)
- [ ] JWT access + refresh tokens
- [ ] Endpoints:
  - [ ] POST `/auth/register`
  - [ ] POST `/auth/login`
  - [ ] POST `/auth/refresh`

---

## Phase 3 — Weight tracking (end-to-end)
### UX goals
- Fast single-field weigh-in (ideally 1 tap + numeric input).
- Trend-first visuals (reduce noise) with simple interpretation.
- Clear feedback loop: weight trend vs target + adherence context.

### Frontend (detailed UI tasks)
- [ ] Add navigation entry: Weight
- [ ] Weight screen layout
  - [ ] Primary action: Add weigh-in (sticky button)
  - [ ] Current trend summary card
    - [ ] 7-day average
    - [ ] 14-day average
    - [ ] change vs last week
  - [ ] Chart module
    - [ ] toggle: 7d / 30d / 90d
    - [ ] show raw points + moving average line
    - [ ] goal band (optional)
  - [ ] History table
    - [ ] inline edit (date/weight)
    - [ ] delete entry with undo (toast)
- [ ] Add weigh-in modal
  - [ ] weight input (kg) + date/time picker + optional note
  - [ ] quick actions: today, yesterday
  - [ ] validation and friendly error copy

### Backend
- [ ] Model + migration: `weight_entries` (user_id, datetime, weight_kg, note)
- [ ] Endpoints:
  - [ ] POST `/weights`
  - [ ] GET `/weights?from=&to=`
  - [ ] PATCH `/weights/{id}`
  - [ ] DELETE `/weights/{id}`
- [ ] Add validations: sane weight range, timezone-safe datetime normalization.

---

## Phase 4 — Food catalog + daily logging (end-to-end)
### Data model
- [ ] `foods` table (global + user foods): name, brand optional, kcal_100g, protein_100g, carbs_100g, fat_100g
- [ ] `days` table (user_id, date)
- [ ] `meal_entries` table (day_id, meal_type, food_id nullable, recipe_id nullable, grams, servings)

### Backend
- [ ] Foods endpoints:
  - [ ] POST `/foods`
  - [ ] GET `/foods?query=`
  - [ ] PUT `/foods/{id}`
- [ ] Day endpoints:
  - [ ] POST `/days/{date}/entries`
  - [ ] GET `/days/{date}` (returns meals + totals)
- [ ] Totals computation:
  - [ ] per-meal totals
  - [ ] per-day totals

### UX goals
- Reduce friction for logging: search, recent items, and repeat actions.
- Keep attention on the daily budget: remaining kcal + macro bars.
- Make portion entry obvious and fast (grams default, serving optional).

### Frontend (detailed UI tasks)
- [ ] Global app shell
  - [ ] Responsive layout (mobile-first)
  - [ ] Primary navigation: Today, Plan, Recipes, Weight, Settings
  - [ ] Persistent quick-add button on mobile

- [ ] Dashboard Today
  - [ ] Remaining calories card (consumed, remaining, target)
  - [ ] Macro bars (P/C/F) with grams + percent
  - [ ] Meals list preview (B/L/D/S) with kcal per meal
  - [ ] Quick actions
    - [ ] Add food
    - [ ] Copy yesterday
    - [ ] Add water (optional)

- [ ] Day view
  - [ ] Date switcher (yesterday/today/tomorrow)
  - [ ] Meal sections (breakfast/lunch/dinner/snack)
    - [ ] meal subtotal row (kcal + macros)
    - [ ] add entry button per meal
  - [ ] Entry row design
    - [ ] food name + brand
    - [ ] grams input (inline) + kcal
    - [ ] swipe actions (mobile): edit, delete

- [ ] Food search and create
  - [ ] Search input with debounced results
  - [ ] Tabs: Search, Recent, Favorites
  - [ ] Food detail drawer
    - [ ] macro display per 100g
    - [ ] portion picker: grams + quick presets (50g, 100g, 200g)
    - [ ] add-to-meal CTA
  - [ ] Create food form
    - [ ] per-100g fields with auto kcal validation
    - [ ] optional serving size label

---

## Phase 5 — Targets + template day (2200 kcal) + scaling
### Backend
- [ ] User targets:
  - [ ] `user_targets` table (kcal_target, protein_g, carbs_g, fat_g)
  - [ ] endpoints to set/get targets
- [ ] Template day storage (seed data) for 2200 kcal recomposition day
- [ ] Scaling rules:
  - [ ] scale portions by kcal ratio (with constraints)
  - [ ] preserve protein minimum while scaling carbs/fats

### UX goals
- Make targets understandable and editable without nutrition expertise.
- Prevent inconsistent macro targets.

### Frontend (detailed UI tasks)
- [ ] Targets screen
  - [ ] Mode selector: kcal only / kcal + macros
  - [ ] Presets: recomposition, endurance, maintenance
  - [ ] Inputs
    - [ ] kcal target
    - [ ] protein/carbs/fat grams
    - [ ] show computed kcal from macros + mismatch warning
  - [ ] Optional schedule
    - [ ] lift day, run day, rest day targets
  - [ ] Save confirmation + effective date
- [ ] Show targets on dashboard and day view
  - [ ] remaining kcal and remaining macros
  - [ ] warnings for very low protein

---

## Phase 6 — Recipes (required for weekly recipe generation)
### Data model
- [ ] `recipes` (user_id, name, servings)
- [ ] `recipe_items` (recipe_id, food_id, grams)

### Backend
- [ ] CRUD endpoints for recipes
- [ ] Recipe macro computation per serving

### UX goals
- Make recipe creation feel like assembling building blocks.
- Keep per-serving and total batch macros always visible.

### Frontend (detailed UI tasks)
- [ ] Recipes list
  - [ ] search + filters (high protein, under 30 min)
  - [ ] pin favorites
- [ ] Recipe builder
  - [ ] Recipe meta: name, servings, prep time, tags
  - [ ] Ingredient picker (reuse food search)
  - [ ] Ingredient rows: grams + kcal + macros
  - [ ] Sticky summary footer: total + per serving
  - [ ] Save and Add-to-plan actions
- [ ] Recipe details
  - [ ] per-serving macros (kcal, P/C/F)
  - [ ] ingredients list with grams
  - [ ] scale servings (recompute)
  - [ ] add ingredients to grocery list (optional)

---

## Phase 7 — Weekly meal plan generation + grocery list
### Data model
- [ ] `weekly_plans` (user_id, week_start)
- [ ] `weekly_plan_days` (weekly_plan_id, date)
- [ ] `weekly_plan_meals` or reuse meal entries (decide approach)

### Backend
- [ ] Generate weekly plan endpoint:
  - [ ] POST `/plans/weekly/generate` (inputs: target_kcal, macro split, training schedule, preferences)
- [ ] Fetch weekly plan:
  - [ ] GET `/plans/weekly/{week_start}`
- [ ] Grocery list:
  - [ ] GET `/plans/weekly/{week_start}/grocery-list` (aggregated ingredients/foods/grams)
- [ ] Export formats:
  - [ ] JSON (default)
  - [ ] CSV (optional)

### UX goals
- Weekly planning should be calm and overview-first.
- Swapping meals should take seconds.
- Grocery list should be store-aisle friendly.

### Frontend (detailed UI tasks)
- [ ] Weekly plan
  - [ ] Week picker (Mon-Sun) with previous/next
  - [ ] Generate plan panel
    - [ ] choose template (2200 recomposition)
    - [ ] set target kcal and training schedule
    - [ ] dietary preferences toggles (optional)
  - [ ] Weekly overview grid
    - [ ] day cards with kcal + macro summary
    - [ ] meal rows (B/L/D/S) with recipe names
  - [ ] Day detail drawer
    - [ ] show meals + per-meal totals
    - [ ] swap action (opens recipe selector)
    - [ ] lock meal to prevent regeneration changes

- [ ] Grocery list
  - [ ] Grouping controls
    - [ ] by category (default)
    - [ ] by recipe
  - [ ] Item row
    - [ ] ingredient name + total grams
    - [ ] checkbox + persist checked state
  - [ ] Actions
    - [ ] copy to clipboard
    - [ ] export CSV
    - [ ] print-friendly view

---

## Phase 8 — Competitive UX alignment (research outputs → UI improvements)
### Research checklist
- [ ] Review onboarding + daily logging flows (public) for:
  - [ ] MyFitnessPal
  - [ ] Cronometer
  - [ ] LoseIt
  - [ ] MacroFactor
  - [ ] Lifesum
  - [ ] EatThisMuch
- [ ] Create a small UI pattern inventory
  - [ ] navigation model and information architecture
  - [ ] daily budget visualization patterns
  - [ ] food search patterns (recent/favorites/barcode)
  - [ ] weight trend visualization patterns
  - [ ] weekly planning patterns

### Incorporate best practices (turn into tickets)
- [ ] One-handed mobile logging patterns (bottom sheet, sticky CTA)
- [ ] Recent foods + favorites everywhere you can add an entry
- [ ] Copy yesterday entries from Today screen
- [ ] Empty states that teach (first weigh-in, first logged meal)
- [ ] Clear remaining kcal + macro bars, always visible on Today and Day view
- [ ] Undo for destructive actions (delete entry, remove ingredient)
- [ ] Accessibility baseline
  - [ ] color contrast
  - [ ] keyboard navigation
  - [ ] screen reader labels for form controls

---

## Phase 9 — Production hardening (Docker + ops)
### Backend
- [ ] Run via Gunicorn/Uvicorn workers in prod container
- [ ] Standardized error responses
- [ ] Rate limiting (Nginx or API)
- [ ] CORS allowlist and security headers

### Database
- [ ] Backups: documented `pg_dump` procedure and restore steps
- [ ] Migrations strategy:
  - [ ] one-off migration job container
  - [ ] or init container pattern

### Frontend
- [ ] Nginx SPA routing (history fallback)
- [ ] Reverse proxy `/api` to backend

### Observability
- [ ] `/healthz` and `/readyz`
- [ ] structured logs with request IDs
- [ ] optional metrics endpoint

---

## Phase 10 — Suggested future features (post-MVP)
- [ ] Adaptive targets engine (trend weight + adherence adjusts calories)
- [ ] Training-day carb cycling (auto-shift carbs on run days)
- [ ] Barcode scanning + external food DB integration
- [ ] Micronutrient tracking (Cronometer-like)
- [ ] Photo meal logging assistance
- [ ] Meal prep mode (batch cook recipes, auto-portion)
- [ ] Wearables integration (Garmin/Strava)

---

## Delivery order summary (execute sequentially)
1) Phase 1 (Docker skeleton)
2) Phase 2 (Backend foundation + auth)
3) Phase 3 (Weight tracking vertical slice)
4) Phase 4 (Food logging vertical slice)
5) Phase 5 (Targets + 2200 template)
6) Phase 6 (Recipes)
7) Phase 7 (Weekly plans + grocery list)
8) Phase 8 (UX polish from competitive research)
9) Phase 9 (Production hardening)
10) Phase 10 (advanced features)
