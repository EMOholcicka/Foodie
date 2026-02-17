# Database migrations (Alembic)

Alembic lives under [`apps/api/alembic/`](apps/api/alembic/:1) with config in [`apps/api/alembic.ini`](apps/api/alembic.ini:1).

From repo root you must pass the config path explicitly:

- local: [`apps/api/alembic.ini`](apps/api/alembic.ini:1)
- docker compose: container workdir is the repo root, so use the same path.

## Run migrations with Docker Compose (dev)

From repo root:

```bash
# Start DB (and optionally API)
docker compose up -d db

# Apply latest migrations (runs inside the api container)
docker compose run --rm api alembic -c apps/api/alembic.ini upgrade head
```

## Run migrations with Docker Compose (prod-like)

From repo root:

```bash
docker compose -f docker-compose.prod.yml up -d db

docker compose -f docker-compose.prod.yml run --rm api alembic -c apps/api/alembic.ini upgrade head
```

## Create a new migration (manual)

Autogeneration requires importing models inside [`apps/api/alembic/env.py`](apps/api/alembic/env.py:1).

```bash
docker compose run --rm api alembic -c apps/api/alembic.ini revision -m "your message" --autogenerate
```
