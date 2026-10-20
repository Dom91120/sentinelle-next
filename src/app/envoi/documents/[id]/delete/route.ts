import { supprimer } from "@/modules/documents/routes";
import { requireUser } from "@/server/guards";
import { idDe, pasTrouve, traiterFormulaire } from "@/server/http";

/** POST /documents/<id>/delete */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => supprimer(await requireUser(), id, req));
}
