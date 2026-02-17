# Phase 9 — Production hardening (Docker + ops)

Goal: make the stack safe and operable in a small production deployment (Docker Compose + nginx edge), with predictable runtime behavior, consistent error contracts, and basic observability.

This doc is an actionable checklist with concrete file-level changes. It does **not** implement anything.

## Current repo notes (baseline)

- Compose exists for dev and prod-like: [`docker-compose.yml`](docker-compose.yml:1), [`docker-compose.prod.yml`](docker-compose.prod.yml:1)
- Edge nginx exists with `/api/*` proxy contract: [`infra/nginx/nginx.dev.conf`](infra/nginx/nginx.dev.conf:1), [`infra/nginx/nginx.prod.conf`](infra/nginx/nginx.prod.conf:1)
- API container runs `uvicorn` directly in prod target: [`apps/api/Dockerfile`](apps/api/Dockerfile:1)
- Web container `prod` serves SPA static files only (no `/api` proxy inside it): [`apps/web/Dockerfile`](apps/web/Dockerfile:1), [`apps/web/nginx.default.conf`](apps/web/nginx.default.conf:1)
- API already has:
  - request IDs middleware + JSON logs: [`apps/api/app/core/logging.py`](apps/api/app/core/logging.py:1)
  - `/healthz` and `/readyz` endpoints (currently always-ready): [`apps/api/app/routes/health.py`](apps/api/app/routes/health.py:1)
  - CORS configuration with a guardrail against `*` when credentials enabled: [`apps/api/app/main.py`](apps/api/app/main.py:1)
  - migrations doc: [`docs/migrations.md`](docs/migrations.md:1)

## Checklist (ordered)

### 1) Production app server: gunicorn + uvicorn workers

**Why**: `uvicorn` alone is fine for dev, but production typically wants a pre-fork supervisor (gunicorn) + tuned workers/timeouts.

**Concrete changes**

- Add gunicorn to API dependencies
  - Update [`apps/api/pyproject.toml`](apps/api/pyproject.toml:1): add `gunicorn` (and optionally `uvicorn-worker` via `uvicorn[standard]` is already present).
  - Keep Dockerfile install list in sync.
- Add a gunicorn config module
  - New: [`apps/api/app/core/gunicorn_conf.py`](apps/api/app/core/gunicorn_conf.py:1)
    - read env: `WEB_CONCURRENCY`, `GUNICORN_TIMEOUT`, `GUNICORN_GRACEFUL_TIMEOUT`, `GUNICORN_KEEPALIVE`
    - bind `0.0.0.0:8000`
    - worker class `uvicorn.workers.UvicornWorker`
    - sensible defaults based on CPU count.
- Switch prod container CMD to gunicorn
  - Update [`apps/api/Dockerfile`](apps/api/Dockerfile:1) `prod` target `CMD` to run gunicorn with config.
  - Update [`docker-compose.prod.yml`](docker-compose.prod.yml:1) `api.command` to the same gunicorn invocation (explicit prod command).
- Document runtime knobs
  - Add env vars (document-only for now): `WEB_CONCURRENCY`, `GUNICORN_TIMEOUT`, `GUNICORN_GRACEFUL_TIMEOUT`, `GUNICORN_KEEPALIVE`, `GUNICORN_LOG_LEVEL`.

**Runtime knobs (API)**

The API `prod` container runs gunicorn with uvicorn workers using [`apps/api/app/core/gunicorn_conf.py`](apps/api/app/core/gunicorn_conf.py:1).

- `WEB_CONCURRENCY`: number of workers (default: `min(4, max(2, CPU))`)
- `GUNICORN_TIMEOUT`: hard request timeout seconds (default: `60`)
- `GUNICORN_GRACEFUL_TIMEOUT`: graceful shutdown timeout seconds (default: `30`)
- `GUNICORN_KEEPALIVE`: keep-alive seconds (default: `5`)
- `GUNICORN_LOG_LEVEL`: `info`/`debug`/`warning`… (default: `info`)

**Recommended starting values (small deployments)**

- `WEB_CONCURRENCY=2` (bump to 3–4 only if CPU/memory allow and load warrants it)
- `GUNICORN_TIMEOUT=60`
- `GUNICORN_GRACEFUL_TIMEOUT=30`
- `GUNICORN_KEEPALIVE=5`
- `GUNICORN_LOG_LEVEL=info`

**Acceptance criteria**

- `docker compose -f docker-compose.prod.yml up api` starts API via gunicorn (not uvicorn).
- `/healthz` responds 200 via nginx edge.
- Worker count is configurable via `WEB_CONCURRENCY`.

**Requires**

- Code → review → tests (API startup smoke test).

---

### 2) Standardized error responses (API-wide)

**Why**: consistent, debuggable client contract; include `request_id` everywhere.

**Concrete changes**

- Add global exception handlers
  - Update [`apps/api/app/main.py`](apps/api/app/main.py:1): register handlers for:
    - request validation errors (`RequestValidationError`)
    - `HTTPException`
    - unhandled `Exception`
- Define a shared error schema
  - New: [`apps/api/app/schemas/errors.py`](apps/api/app/schemas/errors.py:1) (e.g. `ErrorResponse`, `ErrorDetail`)
  - Ensure includes: `code`, `message`, `request_id`, optional `details`.
- Make handlers log with structured context
  - Update [`apps/api/app/core/logging.py`](apps/api/app/core/logging.py:1) or introduce helper to log exceptions with `request_id`.

**Acceptance criteria**

- Any 4xx/5xx response contains a predictable JSON shape and an `X-Request-ID` header.
- Tests cover one validation failure + one forced server error.

**Requires**

- Code → review → tests (API tests under [`apps/api/tests/`](apps/api/tests/:1)).

---

### 3) Rate limiting strategy (edge-first, app-aware)

**Decision point**: where to enforce?

Recommended: start with **nginx edge** limits (cheap, effective). Optionally add **app-level** limits for auth endpoints and write-heavy routes.

**Concrete changes**

- Edge rate limits
  - Update [`infra/nginx/nginx.prod.conf`](infra/nginx/nginx.prod.conf:1):
    - `limit_req_zone` keyed by `$binary_remote_addr` (and optionally `$http_authorization` for authenticated paths)
    - apply stricter limits on `/api/auth/*` and login/refresh endpoints
    - apply moderate global limit on `/api/`
- App-level (optional)
  - Add dependency and middleware (e.g. `slowapi` or custom token bucket)
  - Update [`apps/api/app/main.py`](apps/api/app/main.py:1) and route-level dependencies under [`apps/api/app/routes/`](apps/api/app/routes/:1)

**Acceptance criteria**

- Excessive requests receive HTTP 429 with a consistent body shape (aligned with standardized errors).
- Limits are configurable via env (at least in prod nginx config via template or documented edit).

**Requires**

- Nginx config change → review.
- If app-level added: code → review → tests.

---

### 4) Security headers + CORS tightening

**Why**: sensible defaults when deployed behind nginx; avoid browser foot-guns.

**Concrete changes**

- Set headers at the edge (preferred)
  - Update [`infra/nginx/nginx.prod.conf`](infra/nginx/nginx.prod.conf:1):
    - `add_header X-Content-Type-Options nosniff always;`
    - `add_header Referrer-Policy no-referrer always;` (or `strict-origin-when-cross-origin`)
    - `add_header Permissions-Policy ... always;`
    - `add_header X-Frame-Options DENY always;` (or CSP frame-ancestors)
    - `add_header Content-Security-Policy ... always;` (start conservative; SPA needs explicit allowances)
    - ensure headers also apply on `/api/` responses.

- HSTS (`Strict-Transport-Security`)
  - Set **only** at the TLS termination point.
    - If nginx terminates TLS (you have a `listen 443 ssl;` server block), add HSTS there.
    - If TLS terminates upstream (e.g. CDN / load balancer / ingress), configure HSTS at that layer instead.
  - Do **not** add HSTS to a plain HTTP-only nginx config.

- Confirm CORS origins in prod are explicit
  - Ensure `CORS_ORIGINS` is set in prod deployment docs; do not default to localhost.
  - Consider adding `ENV=prod` in prod compose and make API fail-fast for missing CORS (optional policy).

**Acceptance criteria**

- Response headers include the configured security headers from nginx.
- Browser app still functions through nginx edge.

**Requires**

- Nginx config change → review.
- If CSP is introduced: UI review required (manual QA of SPA navigation + API calls).

---

### 5) Readiness: real dependency checks

**Why**: `/readyz` should indicate whether the app can serve real traffic (DB reachable, migrations applied).

**Concrete changes**

- Implement DB connectivity check
  - Update [`apps/api/app/routes/health.py`](apps/api/app/routes/health.py:1):
    - `readyz` should attempt a lightweight DB query via existing session/engine (e.g. `SELECT 1`).
- Optionally validate schema version
  - Add a check comparing current Alembic head vs DB version (requires reading alembic version table).
- Update compose healthcheck if needed
  - Confirm healthchecks for API use `/healthz` (liveness) not `/readyz`.

**Acceptance criteria**

- With DB down, `/readyz` returns non-200.
- With DB up, `/readyz` returns 200.

**Requires**

- Code → review → tests.

---

### 6) Migrations strategy in production: init job vs sidecar

**Why**: ensure schema is applied exactly once per deploy, safely.

**Preferred approach**: dedicated **migration job** container run during deploy.

**Concrete changes**

- Add a `migrate` service (or one-off command) to prod compose
  - Update [`docker-compose.prod.yml`](docker-compose.prod.yml:1):
    - Add service `migrate` using `api` image that runs `alembic ... upgrade head`.
    - Gate API start on migrate completion (compose doesn’t have native job completion; document deploy sequence).
- Document the deploy sequence
  - Update [`docs/migrations.md`](docs/migrations.md:1): add a `Production` section:
    - `docker compose -f docker-compose.prod.yml run --rm api alembic ... upgrade head` before `up -d`.

**Acceptance criteria**

- There is a documented, repeatable deploy procedure that applies migrations before starting API.
- Rolling back has a documented note (no automatic downgrade assumed).

**Requires**

- Compose + docs change → review.

---

### 7) DB backup/restore docs and a minimal backup job

**Why**: operational safety; backups should not rely on manual shell history.

**Concrete changes**

- Add docs
  - New: [`docs/backups.md`](docs/backups.md:1)
    - `pg_dump` command examples for containerized DB
    - retention guidance (document only)
    - restore instructions (`psql` / `pg_restore`)
- Optional: add a `backup` compose service for on-demand dumps
  - Update [`docker-compose.prod.yml`](docker-compose.prod.yml:1) (or create [`infra/compose/docker-compose.ops.yml`](infra/compose/docker-compose.ops.yml:1)):
    - service `db-backup` using `postgres:16-alpine` image
    - mount a host volume path for dumps

**Acceptance criteria**

- A newcomer can perform backup + restore from docs alone.

**Requires**

- Docs only (plus optional compose change) → review.

---

### 8) Frontend nginx: SPA routing + `/api` proxy alignment

**Why**: currently edge nginx proxies `/` to the `web` container; `web`’s own nginx serves only static content and doesn’t proxy `/api`. That’s OK when edge nginx handles `/api`, but confirm prod topology and remove ambiguity.

**Concrete changes**

- Confirm single edge is authoritative
  - Keep `/api` proxy ONLY in [`infra/nginx/nginx.prod.conf`](infra/nginx/nginx.prod.conf:1).
  - Ensure [`apps/web/nginx.default.conf`](apps/web/nginx.default.conf:1) remains SPA-only.
- Optional: add cache headers for static assets
  - Update [`apps/web/nginx.default.conf`](apps/web/nginx.default.conf:1): long-cache for hashed assets, no-cache for `index.html`.

**Acceptance criteria**

- Refreshing deep SPA routes works (history fallback).
- Browser API calls go to `/api/*` and are served by edge nginx.

**Requires**

- Nginx config change → review.
- If caching changes: UI review required (ensure new deploys aren’t stuck on old `index.html`).

---

### 9) Request IDs propagation + log correlation

**Why**: request IDs exist already; ensure they are consistently forwarded by nginx and included in error bodies.

**Concrete changes**

- Edge propagation
  - Update [`infra/nginx/nginx.prod.conf`](infra/nginx/nginx.prod.conf:1):
    - forward `X-Request-ID` from client to API (`proxy_set_header X-Request-ID $http_x_request_id;`)
    - optionally generate one at edge if missing (requires `map` + `$request_id` support depending on nginx build).
- Ensure API error payload includes request id
  - Part of standardized error work: handlers read from [`apps/api/app/core/logging.py`](apps/api/app/core/logging.py:1) `get_request_id()`.

**Acceptance criteria**

- A client-supplied `X-Request-ID` is echoed back and appears in logs.

**Requires**

- Nginx config change → review.
- Code → review → tests.

---

### 10) Optional metrics: Prometheus endpoint or OpenTelemetry

**Why**: lightweight observability; keep optional to avoid premature complexity.

**Option A (simple)**: `/metrics` with `prometheus-client`.

**Concrete changes**

- Add dependency in [`apps/api/pyproject.toml`](apps/api/pyproject.toml:1)
- Add middleware / instrumentation
  - New: [`apps/api/app/core/metrics.py`](apps/api/app/core/metrics.py:1)
  - Update [`apps/api/app/main.py`](apps/api/app/main.py:1)
- Add nginx allowlist / protect endpoint
  - Update [`infra/nginx/nginx.prod.conf`](infra/nginx/nginx.prod.conf:1)

**Acceptance criteria**

- `/metrics` available (optionally behind auth or internal-only routing).

**Requires**

- Code → review → tests (basic scrape test).

## Test plan summary (what to add)

- API unit/integration tests
  - error contract tests: standardized payload shape
  - readiness test with DB up/down (can be mocked or use test DB)
  - request id propagation test (header present)
- Smoke checks for containers
  - `docker compose -f docker-compose.prod.yml up` should stabilize with healthy services

### Running backend tests in Docker

The production image stays minimal; tests run in a dedicated Compose service that targets the API Dockerfile `test` stage.

Canonical command:

- `docker compose run --rm api-test`

Passing additional args:

- The `api-test` service is defined with a default command (typically `pytest`).
- Any extra tokens after the service name are appended to that command.

Examples:

- Run the full suite (explicit): `docker compose run --rm api-test pytest`
- Run a single test file: `docker compose run --rm api-test pytest apps/api/tests/test_healthz.py`
- Run with flags: `docker compose run --rm api-test -k readyz -q`

Notes:

- The service depends on `db` being healthy and uses the same `DATABASE_URL` default as dev.
- If you want a clean DB volume run, use `docker compose down -v` before re-running tests.

## Review gates

- Any change under [`apps/api/app/`](apps/api/app/:1) or [`apps/api/Dockerfile`](apps/api/Dockerfile:1): backend code review + tests.
- Any change under [`infra/nginx/`](infra/nginx/:1) or [`apps/web/nginx.default.conf`](apps/web/nginx.default.conf:1): ops review.
- Any CSP/caching change affecting browser behavior: UI review (manual).
