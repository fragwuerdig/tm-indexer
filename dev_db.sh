#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="local-postgres-db"

set -a
. ./.env
set +a

# Read env vars or use defaults
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
DB_PORT="${DB_PORT:-5432}"

echo "Using DB_USER=${DB_USER}, DB_NAME=${DB_NAME}, DB_PORT=${DB_PORT}"

start_db() {
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Recreating container ${CONTAINER_NAME} with new environment..."
    docker rm -f "${CONTAINER_NAME}" >/dev/null
  fi

  echo "Creating and starting ${CONTAINER_NAME}..."
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -e POSTGRES_USER="${DB_USER}" \
    -e POSTGRES_PASSWORD="${DB_PASS}" \
    -e POSTGRES_DB="${DB_NAME}" \
    -p "${DB_PORT}:5432" \
    postgres:16-alpine >/dev/null

  echo "Postgres running on port ${DB_PORT}"
}

stop_db() {
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping and removing ${CONTAINER_NAME} with volumes..."
    docker rm -f -v "${CONTAINER_NAME}" >/dev/null
  else
    echo "Container ${CONTAINER_NAME} not found"
  fi
}
case "${1:-}" in
  start) start_db ;;
  stop) stop_db ;;
  restart)
    stop_db
    start_db
    ;;
  *)
    echo "Usage: $0 {start|stop|restart}"
    exit 1
    ;;
esac
