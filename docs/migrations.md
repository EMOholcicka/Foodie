# Database migrations (Alembic)

Alembic lives under [`apps/api/alembic/`](apps/api/alembic/:1) with config in [`apps/api/alembic.ini`](apps/api/alembic.ini:1).

## Demo seed data

A demo seed migration exists to make the app immediately usable for screenshots/demos.

It creates a dedicated demo account plus demo foods/recipes and a generated weekly plan for the current week start (Monday).

- Demo email: `demo@foodie.local`
- Demo password: `demo1234`

### Apply demo data

In dev, [`docker-compose.yml`](docker-compose.yml:1) enables demo seed data **by default** for the dedicated `migrate` job (so `docker compose up` gives you a usable demo account immediately).

To disable demo seeding in dev:

```bash
FOODIE_DEMO_SEED=0 docker compose up --build
```

Manual / non-compose runs remain **opt-in** and are **NOT** applied by default when you run:

```bash
alembic -c apps/api/alembic.ini upgrade head
```

To seed demo data, explicitly enable it for the migration run:

```bash
FOODIE_DEMO_SEED=1 alembic -c apps/api/alembic.ini upgrade head
```

Production warning:
- Do **not** enable `FOODIE_DEMO_SEED` in production.
- The demo seed inserts a known demo user (`demo@foodie.local`) with a known password intended only for local/dev/demo environments.

### Remove demo data (optional)

Downgrade the last migration:

```bash
alembic -c apps/api/alembic.ini downgrade -1
```

Notes:
- The seed is designed to be idempotent (safe to re-run).
- Demo foods/recipes are user-owned (scoped to the demo user), so they don't pollute global/shared data.

## Dev: apply migrations via dedicated compose job

In dev, migrations are run by a dedicated one-off compose service (`migrate`) which executes `alembic upgrade head` and then exits.

### Portable workflow (recommended)

Run the one-off migration job first, then start the stack:

```bash
docker compose run --rm migrate
docker compose up --build
```

This is the most portable workflow across Docker Compose implementations.

### Optional: automatic dependency (Compose v2+)

The `api` service is configured to depend on `migrate` completing successfully via `depends_on: condition: service_completed_successfully`.

If your Compose implementation does not support `service_completed_successfully`, use the portable workflow above.

Note: the `migrate` service sets `PYTHONPATH=/app` so Alembic can import the API package (`import app`) when running inside the container.

## Test runner: explicit migrations (compose)

The [`api-test` service](docker-compose.yml:48) never auto-migrates. It runs migrations explicitly before executing pytest:

```bash
docker compose run --rm api-test
```

Under the hood it executes:

- `alembic -c /app/alembic.ini upgrade head`
- `pytest -q`

## Manual migration commands

### Local

From repo root:

```bash
alembic -c apps/api/alembic.ini upgrade head
```

### Docker Compose (dev)

```bash
# Start DB
docker compose up -d db

# Apply latest migrations (recommended: dedicated migrate job)
docker compose run --rm migrate

# (Alternative) run alembic directly in the api image
docker compose run --rm api alembic -c /app/alembic.ini upgrade head
```

### Docker Compose (prod-like)

Auto-migrate is not enabled in [`docker-compose.prod.yml`](docker-compose.prod.yml:1).

The API image sets `WORKDIR /app` and copies the code to `/app/app`, so the Alembic config inside the container is at `/app/alembic.ini`.

```bash
docker compose -f docker-compose.prod.yml up -d db

docker compose -f docker-compose.prod.yml run --rm api alembic -c /app/alembic.ini upgrade head
```

## Create a new migration (manual)

Autogeneration requires importing models inside [`apps/api/alembic/env.py`](apps/api/alembic/env.py:1).

```bash
docker compose run --rm api alembic -c /app/alembic.ini revision -m "your message" --autogenerate
```
