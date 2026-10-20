import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests d'INTÉGRATION (port des tests pytest de Sentinelle) : une base PostgreSQL
 * de test et un serveur Next lancé pour la session (tests/setup/global.ts).
 * `pnpm test:integration` ; la base vient de DATABASE_URL_TEST (ou de DATABASE_URL
 * avec la base `sentinelle_test`), créée et migrée au préalable.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/setup/global.ts"],
    setupFiles: ["tests/setup/env.ts"],
    // Une seule base : les fichiers s'exécutent l'un après l'autre.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
