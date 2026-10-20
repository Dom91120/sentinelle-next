import { timingSafeEqual } from "node:crypto";
import { parseAndRecord } from "@/modules/backups/server";
import { getSettings } from "@/server/config-store";
import { json } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

function memeJeton(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * POST /backups/ingest : point d'entrée machine-to-machine (mail récap transféré
 * par une règle/flux). Sécurisé par un jeton (BACKUP_INGEST_TOKEN), pas de
 * session utilisateur ni de CSRF.
 */
export async function POST(req: Request) {
  const token = (await getSettings()).BACKUP_INGEST_TOKEN;
  if (!token) return json({ ok: false, error: "Ingestion desactivee (BACKUP_INGEST_TOKEN non defini)." }, 503);
  const url = new URL(req.url);
  const provided = req.headers.get("x-sentinelle-token") || url.searchParams.get("token") || "";
  if (!memeJeton(provided, token)) return json({ ok: false, error: "Jeton invalide." }, 403);
  let subject = "";
  let body = "";
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const data = (await req.json().catch(() => ({}))) as { subject?: string; body?: string };
    subject = data.subject ?? "";
    body = data.body ?? "";
  } else {
    subject = url.searchParams.get("subject") ?? "";
    body = (await req.text()) || "";
  }
  const results = await parseAndRecord(subject, body);
  if (results.length) invalidateNavCounts();
  return json({ ok: true, updated: results, count: results.length });
}
