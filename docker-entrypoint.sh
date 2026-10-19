#!/bin/sh
set -e

# Applique les migrations Prisma au démarrage (idempotent)
echo "→ prisma migrate deploy"
node ./node_modules/prisma/build/index.js migrate deploy

echo "→ démarrage de Sentinelle"
exec "$@"
