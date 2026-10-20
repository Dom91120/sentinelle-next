/**
 * Environnement des tests d'intégration : la base de TEST (jamais celle de
 * développement), les mêmes réglages que le serveur de test, et le mode test qui
 * coupe les caches (configuration, compteurs du menu) pour que chaque écriture en
 * base se voie à la requête suivante.
 */
import "dotenv/config";

export const PORT = Number.parseInt(process.env.SENTINELLE_TEST_PORT ?? "3100", 10);
export const BASE_URL = process.env.SENTINELLE_TEST_URL ?? `http://localhost:${PORT}`;
export const ADMIN_PASSWORD = "mdp-de-test";
export const CRON_SECRET = "secret-cron-de-test";

/** L'URL de la base de test : DATABASE_URL_TEST, ou DATABASE_URL avec la base `sentinelle_test`. */
let urlTest: string | null = null;
export function urlBaseTest(): string {
  if (urlTest) return urlTest;
  if (process.env.DATABASE_URL_TEST) {
    urlTest = process.env.DATABASE_URL_TEST;
    return urlTest;
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url)
    throw new Error(
      "DATABASE_URL (ou DATABASE_URL_TEST) absent : impossible de lancer les tests d'intégration.",
    );
  const remplacee = url.replace(/\/([^/?]+)(\?|$)/, "/sentinelle_test$2");
  if (!remplacee.includes("/sentinelle_test"))
    throw new Error(`Impossible de dériver la base de test de ${url}`);
  urlTest = remplacee;
  return urlTest;
}

/** Les variables d'environnement partagées par le processus de test et le serveur de test. */
export function envTest(): Record<string, string> {
  return {
    DATABASE_URL: urlBaseTest(),
    BETTER_AUTH_URL: BASE_URL,
    NEXT_PUBLIC_APP_URL: BASE_URL,
    APP_BASE_URL: BASE_URL,
    APP_URL: BASE_URL,
    APP_PORT: String(PORT),
    PORT: String(PORT),
    ADMIN_INITIAL_PASSWORD: ADMIN_PASSWORD,
    SENTINELLE_TEST: "1",
    DEV_SCHEDULER: "false",
    NEXT_DIST_DIR: ".next-test",
    CRON_SECRET,
    TRUST_PROXY: "true",
    LOGIN_MAX_ATTEMPTS: "3",
    REQUIRE_2FA_ADMIN: "false",
    MAIL_ENABLED: "true",
    ALERT_RECIPIENTS: "",
    LDAP_ENABLED: "false",
  };
}

/** Applique l'environnement de test au processus courant (avant tout import de `@/server/db`). */
export function appliquerEnv(): void {
  for (const [k, v] of Object.entries(envTest())) process.env[k] = v;
}

appliquerEnv();
