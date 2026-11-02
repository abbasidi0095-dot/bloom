#!/usr/bin/env bash
set -euo pipefail

# Bloom backup: compressed database dump + private uploads.
# Install: sudo install -m 700 scripts/backup.sh /usr/local/bin/bloom-backup
# Cron:    15 3 * * * /usr/local/bin/bloom-backup

DB_NAME="${BLOOM_DB_NAME:-bloom}"
DB_USER="${BLOOM_DB_USER:-postgres}"
UPLOAD_DIR="${BLOOM_UPLOAD_DIR:-/home/opc/project/bloom/uploads}"
DEST="${BLOOM_BACKUP_DIR:-/var/backups/bloom}"
STAMP="$(date +%F)"
KEEP_DAYS="${BLOOM_BACKUP_KEEP_DAYS:-14}"

mkdir -p "$DEST"
chmod 700 "$DEST"

sudo -u "$DB_USER" pg_dump -Fc "$DB_NAME" > "$DEST/bloom-${STAMP}.dump"
tar -czf "$DEST/uploads-${STAMP}.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")" 2>/dev/null || true

find "$DEST" -type f -name 'bloom-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DEST" -type f -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "Bloom backup written to $DEST"
