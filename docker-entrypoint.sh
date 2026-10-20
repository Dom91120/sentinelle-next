#!/bin/sh
set -e

# Applique les migrations Prisma au démarrage (idempotent). Par le shim pnpm de
# node_modules/.bin : lancé directement, build/index.js est un vrai répertoire dans
# l'image et ne retrouve plus @prisma/config (rangé sous .pnpm, pas hissé à la racine).
echo "→ prisma migrate deploy"
node_modules/.bin/prisma migrate deploy

echo "→ démarrage de Sentinelle"
exec "$@"
