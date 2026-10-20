import { getSettings } from "@/server/config-store";
import { isAuthorizedCron } from "@/server/cron";
import { json } from "@/server/http";
import { tachesDues } from "@/server/jobs-registre";
import { executerTaches } from "@/server/taches";

export const maxDuration = 300;

const FENETRE_MS = 5 * 60_000;

/**
 * GET|POST /api/cron/tous : appelé toutes les 5 minutes par le conteneur cron. Exécute les
 * tâches dont l'heure tombe dans la fenêtre écoulée depuis le dernier passage (5 min),
 * selon les horaires hérités de app/scheduler.py. `?forcer=<id,id>` force des tâches.
 */
export async function GET(req: Request) {
  if (!(await isAuthorizedCron())) return json({ error: "Non autorisé." }, 401);
  const url = new URL(req.url);
  const forcer = (url.searchParams.get("forcer") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cfg = await getSettings();
  const jusqua = new Date();
  const depuis = new Date(jusqua.getTime() - FENETRE_MS);
  const ids = forcer.length ? forcer : tachesDues(cfg, depuis, jusqua).map((t) => t.id);
  const resultats = await executerTaches(ids);
  return json({ depuis: depuis.toISOString(), jusqua: jusqua.toISOString(), taches: resultats });
}

export const POST = GET;
