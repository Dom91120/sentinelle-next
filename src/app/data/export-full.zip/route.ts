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
 */
export async function GET(req: Request) {
  await requireAdmin();
  const sansDocuments = ["1", "true", "on"].includes(
    new URL(req.url).searchParams.get("sans_documents") ?? "",
  );
  const [filename, chemin] = await buildFullExport(sansDocuments);
  const st = await fs.stat(chemin);
  const flux = createReadStream(chemin);
  const nettoyer = () =>
    fs.rm(path.dirname(chemin), { recursive: true, force: true }).catch(() => {});
  flux.on("close", nettoyer);
  flux.on("error", nettoyer);
  return new Response(Readable.toWeb(flux) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(st.size),
      "Cache-Control": "no-store",
    },
  });
}
