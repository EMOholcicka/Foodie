# syntax=docker/dockerfile:1

# ---- Base deps ----
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps (keep minimal)
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# ---- Dev target ----
FROM base AS dev

# Install runtime deps (no lock yet in Phase 1)
# Keep this list in sync with [project].dependencies in pyproject.toml
COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir -U pip \
  && pip install --no-cache-dir \
    "fastapi>=0.110" \
    "gunicorn>=21.2" \
    "uvicorn[standard]>=0.27" \
    "psycopg[binary]>=3.1" \
    "sqlalchemy[asyncio]>=2.0" \
    "alembic>=1.13" \
    "pydantic-settings>=2.2" \
    "argon2-cffi>=23.1" \
    "pyjwt>=2.8" \
    "email-validator>=2.1"

COPY app /app/app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---- Test target (adds test-only deps; keep prod minimal) ----
FROM dev AS test

# Keep this list in sync with [project.optional-dependencies].test in pyproject.toml
RUN pip install --no-cache-dir \
    "pytest>=8.0" \
    "pytest-asyncio>=0.23" \
    "httpx>=0.27" \
    "aiosqlite>=0.20"

# Include tests in the image so `docker compose run api-test pytest` works.
COPY tests /app/tests
COPY pytest.ini /app/pytest.ini

# Default command is overridden by compose, but keep a sensible default.
CMD ["pytest", "-q"]

# ---- Prod-like target ----
FROM base AS prod

# Create an unprivileged user for runtime
RUN addgroup --system app \
  && adduser --system --ingroup app --home /app --shell /usr/sbin/nologin app

COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir -U pip \
  && pip install --no-cache-dir \
    "fastapi>=0.110" \
    "gunicorn>=21.2" \
    "uvicorn[standard]>=0.27" \
    "psycopg[binary]>=3.1" \
    "sqlalchemy[asyncio]>=2.0" \
    "alembic>=1.13" \
    "pydantic-settings>=2.2" \
    "argon2-cffi>=23.1" \
    "pyjwt>=2.8" \
    "email-validator>=2.1"

COPY app /app/app
RUN chown -R app:app /app

USER app

EXPOSE 8000
CMD ["gunicorn", "-c", "app.core.gunicorn_conf", "app.main:app"]
