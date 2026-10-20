import { apporterFichier } from "@/modules/documents/routes";
import { requireUser } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /documents/<id>/file : apporte son fichier à une pièce qui n'en a pas. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => apporterFichier(await requireUser(), id, form));
}
