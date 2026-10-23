import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { getSettings } from "@/server/config-store";
import { backupPath } from "@/server/db-backup";
import { requireAdmin } from "@/server/guards";
import { pasTrouve } from "@/server/http";

/**
 * GET /data/db-backup/<nom> : télécharge une sauvegarde du dossier BACKUP_DB_DIR
 * (le .dump tel quel, restaurable par pg_restore). Le nom est contrôlé par
 * `backupPath` : forme attendue, et aucun chemin hors du dossier.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  await requireAdmin();
  const { name } = await params;
  const chemin = backupPath(await getSettings(), name);
  if (!chemin) return pasTrouve();
  let st: Awaited<ReturnType<typeof fs.stat>>;
  try {
    st = await fs.stat(chemin);
  } catch {
    return pasTrouve();
  }
  const flux = createReadStream(chemin);
  return new Response(Readable.toWeb(flux) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(st.size),
      "Cache-Control": "no-store",
    },
  });
}
