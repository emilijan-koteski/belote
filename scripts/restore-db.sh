#!/usr/bin/env bash
# Restore a gzipped pg_dump produced by backup-db.sh.
# Usage:  ./scripts/restore-db.sh /var/backups/beljot/beljot-YYYYMMDDTHHMMSSZ.sql.gz
#
# Stops the api container during restore so no concurrent writes can corrupt the load.
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>" >&2
  exit 1
fi

DUMP="$1"
COMPOSE_DIR=/opt/beljot
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.prod.yml"

if [ ! -f "$DUMP" ]; then
  echo "ERROR: dump file not found: $DUMP" >&2
  exit 1
fi

cd "$COMPOSE_DIR"

set -a
# shellcheck disable=SC1091
. ./.env
set +a

echo "Stopping api to prevent concurrent writes..."
docker compose -f "$COMPOSE_FILE" stop api

echo "Restoring $DUMP into database '$POSTGRES_DB'..."
gunzip -c "$DUMP" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Restarting api..."
docker compose -f "$COMPOSE_FILE" start api

echo "Restore complete."
