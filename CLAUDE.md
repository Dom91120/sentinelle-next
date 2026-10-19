# CLAUDE.md

« sentinelle-next » : portage intégral de l'application Flask « Sentinelle »
(`../sentinelle`) vers Next.js 16 + PostgreSQL, sur le socle technique de « culturesa-next ».
L'inventaire du portage et sa liste de contrôle vivent dans `docs/PORTAGE.md`.

## Commandes

```powershell
pnpm dev                 # serveur de développement (port 3000)
pnpm lint ; pnpm typecheck ; pnpm test
pnpm build
pnpm db:migrate          # migrations Prisma (dev)
pnpm db:init             # rôles, référentiels, compte admin (mot de passe aléatoire en console)
pnpm db:reprise          # reprise de la base SQLite de Sentinelle (voir .env.example)
```

## Conventions (héritées de Sentinelle)

- UI et messages en français. Mêmes écrans, mêmes options, mêmes règles de statut
  (vert / orange / rouge) et même politique d'alerte que l'application d'origine.
- Toute écriture passe par une Server Action ou une route POST protégée : session requise
  puis `requireEdit` / `requireDelete` / `requireAdmin` (`src/server/guards.ts`).
- Toute nouvelle fonctionnalité est activable depuis Préférences (clé `MANAGED` dans
  `src/server/config-store.ts`, repli `.env`). Un module entier se déclare dans
  `src/server/features.ts`.
- Liens par identifiant (`*Id`) plutôt que texte libre ; dates en UTC.
- Schéma : `prisma/schema.prisma` garde les noms de tables et colonnes de Sentinelle
  (`@@map` / `@map`). Toute évolution passe par une migration Prisma.
- Compte admin : mot de passe aléatoire affiché en console, jamais de mot de passe par défaut.
