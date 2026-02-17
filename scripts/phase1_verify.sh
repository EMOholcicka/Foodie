#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf "\n==> %s\n" "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

cleanup_compose() {
  # Always try to tear down, even if checks failed.
  set +e
  docker compose down -v --remove-orphans >/dev/null 2>&1
  set -e
}

main() {
  require_cmd docker
  require_cmd curl

  cd "$ROOT_DIR"

  log "Compose file sanity: parsing docker-compose.yml"
  docker compose config -q

  log "Compose file sanity: parsing docker-compose.prod.yml"
  # prod compose may require POSTGRES_PASSWORD; set a dummy value just for config parsing.
  POSTGRES_PASSWORD="verify-only" docker compose -f docker-compose.prod.yml config -q

  log "Starting dev stack (docker-compose.yml)"
  cleanup_compose
  docker compose up -d --build

  # Ensure we always tear down the stack.
  trap cleanup_compose EXIT

  log "Wait for nginx to respond on :8080"
  # docker healthchecks cover api/db; nginx itself doesn't have a docker healthcheck.
  # Poll nginx a bit to avoid flakiness.
  for i in {1..60}; do
    if curl -fsS "http://localhost:8080/healthz" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  log "Check: API health direct"
  curl -fsS "http://localhost:8000/healthz" | grep -E '"status"\s*:\s*"ok"' >/dev/null

  log "Check: nginx routes /api/healthz to API"
  curl -fsS "http://localhost:8080/api/healthz" | grep -E '"status"\s*:\s*"ok"' >/dev/null

  log "Check: web placeholder served via nginx (/ contains 'Foodie')"
  curl -fsS "http://localhost:8080/" | grep -i "Foodie" >/dev/null

  log "Phase 1 verification complete"
}

main "$@"
