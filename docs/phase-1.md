# Phase 1 — Docker skeleton

This phase sets up a runnable Docker-first skeleton:

- Postgres DB container
- FastAPI API container with `GET /healthz`
- Web container:
  - dev: Vite dev server (React placeholder)
  - prod-like: static build served by nginx
- Edge nginx reverse proxy:
  - `/api/*` -> API
  - `/` -> web

## Verification (automated sanity checks)

Phase 1 is intentionally "thin"—these checks are meant to ensure the skeleton wiring keeps working:

- Compose YAML parses (both dev and prod-like)
- API health endpoint responds (`GET /healthz`)
- Edge nginx routes `GET /api/healthz` to the API
- Web placeholder is served via nginx at `/`

### 1) Quick unit test (no Docker): API `GET /healthz`

```bash
cd apps/api
python -m pip install -e '.[test]'
pytest
```

Test file: [`apps/api/tests/test_healthz.py`](apps/api/tests/test_healthz.py:1)

### 2) Full Phase 1 smoke (Docker): compose up + curl via nginx

Runs:
- `docker compose config -q` (dev)
- `docker compose -f docker-compose.prod.yml config -q` (prod-like; with dummy `POSTGRES_PASSWORD` for parsing)
- `docker compose up -d --build`
- curls:
  - `http://localhost:8000/healthz`
  - `http://localhost:8080/api/healthz`
  - `http://localhost:8080/` (expects "Foodie")
- then tears down the stack

```bash
bash scripts/phase1_verify.sh
```

Script: [`scripts/phase1_verify.sh`](scripts/phase1_verify.sh:1)

## Dev

⚠️ **Dev-only defaults**: [`env.example`](env.example:1) contains insecure placeholder credentials meant only to get Phase 1 running locally.
Do **not** reuse it for real deployments.

```bash
cp env.example .env
docker compose up --build
```

URLs:
- Web (direct): http://localhost:5173
- API (direct): http://localhost:8000/healthz
- Via nginx: http://localhost:8080 (and API at http://localhost:8080/api/healthz)

## Prod-like

⚠️ **Still not production**: [`docker-compose.prod.yml`](docker-compose.prod.yml:1) is "prod-like" for Phase 1 (static web + edge nginx), but it is not hardened.

Security notes:
- Set `POSTGRES_PASSWORD` explicitly (no default in prod-like compose).
- Use an explicit `CORS_ORIGINS` list; `*` is not allowed when credentials are enabled.

```bash
cp env.example .env
# IMPORTANT: edit .env and set POSTGRES_PASSWORD to a strong value before running

docker compose -f docker-compose.prod.yml up --build
```

URL:
- http://localhost:8080
