import { isAuthorizedCron } from "@/server/cron";
import { json } from "@/server/http";
import { executerTache, TACHES } from "@/server/taches";

export const maxDuration = 300;

/** GET|POST /api/cron/<tache> : exécute une tâche précise, hors horaire (diagnostic, rattrapage). */
export async function GET(_req: Request, { params }: { params: Promise<{ tache: string }> }) {
  if (!(await isAuthorizedCron())) return json({ error: "Non autorisé." }, 401);
  const { tache } = await params;
  if (!(tache in TACHES))
    return json({ error: "Tâche inconnue.", taches: Object.keys(TACHES) }, 404);
  return json(await executerTache(tache));
}

export const POST = GET;
