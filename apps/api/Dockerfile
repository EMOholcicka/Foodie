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
COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir -U pip \
  && pip install --no-cache-dir "fastapi>=0.110" "uvicorn[standard]>=0.27" "psycopg[binary]>=3.1"

COPY app /app/app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---- Prod-like target ----
FROM base AS prod

# Create an unprivileged user for runtime
RUN addgroup --system app \
  && adduser --system --ingroup app --home /app --shell /usr/sbin/nologin app

COPY pyproject.toml /app/pyproject.toml
RUN pip install --no-cache-dir -U pip \
  && pip install --no-cache-dir "fastapi>=0.110" "uvicorn[standard]>=0.27" "psycopg[binary]>=3.1"

COPY app /app/app
RUN chown -R app:app /app

USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
