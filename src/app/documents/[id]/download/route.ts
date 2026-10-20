import { telecharger } from "@/modules/documents/routes";
import { requireUser } from "@/server/guards";
import { idDe, pasTrouve } from "@/server/http";

/** GET /documents/<id>/download */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return telecharger(await requireUser(), id);
}
