#!/usr/bin/env bash
# Daily pg_dump → /var/backups/beljot/, gzip, 7-day retention.
# Intended to run via root crontab on the VPS:
#   30 3 * * * /opt/beljot/scripts/backup-db.sh >> /var/log/beljot-backup.log 2>&1
set -euo pipefail

BACKUP_DIR=/var/backups/beljot
RETENTION_DAYS=7
COMPOSE_DIR=/opt/beljot
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.prod.yml"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="${BACKUP_DIR}/beljot-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
cd "$COMPOSE_DIR"

# Load DB credentials from the same .env the compose stack uses.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

# -T disables TTY allocation; required when invoked from cron (no terminal).
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists \
  | gzip -9 > "$OUT"

# Sanity-check the dump is non-trivial in size before we trust it.
if [ ! -s "$OUT" ] || [ "$(stat -c%s "$OUT")" -lt 1024 ]; then
  echo "ERROR: backup is empty or suspiciously small: $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

find "$BACKUP_DIR" -name 'beljot-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "$(date -u +%FT%TZ) backup OK: $OUT ($(du -h "$OUT" | cut -f1))"
