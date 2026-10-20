/**
 * Démarrage du serveur Node : amorçage idempotent de la base (rôles, référentiels,
 * compte admin, configuration), comme `create_app()` le faisait à chaque lancement.
 * Les tâches planifiées, elles, tournent via /api/cron (conteneur cron) et, en
 * développement, via le minuteur interne (server/scheduler.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SENTINELLE_SKIP_BOOT === "true") return;
  try {
    const { amorcer } = await import("@/server/amorcage");
    await amorcer({ annoncer: true });
  } catch (e) {
    console.error("[boot] amorçage impossible :", e);
  }
  // Hors conteneur cron (développement, poste seul), les tâches planifiées tournent
  // dans le processus : DEV_SCHEDULER=true les active, =false les coupe ; défaut = dev.
  const dev =
    process.env.DEV_SCHEDULER ?? (process.env.NODE_ENV === "production" ? "false" : "true");
  if (dev === "true") {
    const { demarrerMinuteurDev } = await import("@/server/scheduler");
    demarrerMinuteurDev();
  }
}
