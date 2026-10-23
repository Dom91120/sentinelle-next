import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { buildFullExport } from "@/server/full-export";
import { requireAdmin } from "@/server/guards";

/**
 * GET /data/export-full.zip (data_io.export_full) : export total de secours.
 * `?sans_documents=1` retire les octets des pièces jointes. Le fichier temporaire
 * est envoyé en flux puis supprimé quand la réponse est close.
 *
 * `?t=<jeton>` : la page le pose au clic et guette son retour dans le cookie
 * `export_pret`, seul moyen de savoir qu'un téléchargement par navigation a commencé
 * (la construction de l'archive peut durer plus d'une minute).
 */
export async function GET(req: Request) {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const jeton = params.get("t") ?? "";
  const sansDocuments = ["1", "true", "on"].includes(params.get("sans_documents") ?? "");
  const [filename, chemin] = await buildFullExport(sansDocuments);
  const st = await fs.stat(chemin);
  const flux = createReadStream(chemin);
  const nettoyer = () =>
    fs.rm(path.dirname(chemin), { recursive: true, force: true }).catch(() => {});
  flux.on("close", nettoyer);
  flux.on("error", nettoyer);
  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": String(st.size),
    "Cache-Control": "no-store",
  });
  if (/^[A-Za-z0-9_-]{8,64}$/.test(jeton))
    headers.append("Set-Cookie", `export_pret=${jeton}; Path=/; Max-Age=120; SameSite=Lax`);
  return new Response(Readable.toWeb(flux) as ReadableStream, { headers });
}
