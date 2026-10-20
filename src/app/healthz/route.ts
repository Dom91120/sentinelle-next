import { prisma } from "@/server/db";
import { json } from "@/server/http";

/**
 * GET /healthz : sonde de supervision, sans authentification. L'app répond, la
 * base est accessible, le planificateur a exécuté un job dans les 26 dernières
 * heures. 200 = OK, 503 = problème. Aucun détail métier.
 */
export async function GET() {
  const out: Record<string, unknown> = { app: "ok", database: "ok", scheduler: "ok" };
  let code = 200;
  try {
    const last = await prisma.schedulerRun.findFirst({ orderBy: { runAt: "desc" } });
    if (!last) out.scheduler = "no_run_yet";
    else {
      const ageH = (Date.now() - last.runAt.getTime()) / 3_600_000;
      out.last_job_hours_ago = Math.round(ageH * 10) / 10;
      if (ageH > 26) {
        out.scheduler = "stale";
        code = 503;
      }
    }
  } catch {
    out.database = "error";
    out.scheduler = "unknown";
    code = 503;
  }
  out.status = code === 200 ? "ok" : "error";
  return json(out, code);
}
