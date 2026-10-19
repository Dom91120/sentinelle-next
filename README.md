# sentinelle-next

Portage de « Sentinelle » (tableau de bord de supervision d'une DSI et inventaire du parc et
des logiciels, avec alertes mail) de Flask / SQLite vers Next.js 16 / PostgreSQL.

- Suivi du portage : [docs/PORTAGE.md](docs/PORTAGE.md)
- Variables d'environnement : [.env.example](.env.example)

## Démarrage en développement

```bash
pnpm install
cp .env.example .env            # renseigner DATABASE_URL et BETTER_AUTH_SECRET
docker run -d --name sentinelle-pg -e POSTGRES_USER=sentinelle -e POSTGRES_PASSWORD=sentinelle \
  -e POSTGRES_DB=sentinelle -p 5432:5432 -v sentinelle-pgdata:/var/lib/postgresql postgres:18.6-alpine
pnpm db:migrate
pnpm db:init                    # affiche le mot de passe admin
pnpm dev
```

## Reprise des données de Sentinelle

```bash
SENTINELLE_SQLITE=../sentinelle/instance/admin_dashboard.db SENTINELLE_SECRET_KEY=... pnpm db:reprise
```

## Production

`docker compose up -d --build` puis `docker compose run --rm init` sur une base vierge.
