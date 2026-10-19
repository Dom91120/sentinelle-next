#!/bin/sh
# Export MANUEL de la base, lancé en ligne de commande sur l'hôte :
#   docker compose exec --user 10001:10001 cron backup.sh
# L'export PLANIFIÉ (01:00, rétention BACKUP_DB_KEEP) est produit par l'app elle-même
# (tâche backup_database via /api/cron/tous). Ce script parle directement à Postgres
# et fonctionne donc même si le conteneur app est HS.
set -eu
DIR=/backups
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$DIR/sentinelle-$STAMP.sql.gz"
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges | gzip -9 > "$OUT"
echo "→ $OUT"
