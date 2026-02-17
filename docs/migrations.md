# Database migrations (Alembic)

Alembic lives under [`apps/api/alembic/`](apps/api/alembic/:1) with config in [`apps/api/alembic.ini`](apps/api/alembic.ini:1).

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
