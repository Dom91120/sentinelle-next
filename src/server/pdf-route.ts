/** Le gestionnaire GET commun aux routes /<entité>/<id>/pdf. */

import type { CurrentUser } from "@/server/guards";
import { ApiAuthError, requireUser } from "@/server/guards";
import { idDe, pasTrouve } from "@/server/http";
import { reponsePdf } from "@/server/pdf";
import type { FichePdf } from "@/server/pdf-fiches";

export function routePdf(construire: (user: CurrentUser, id: number) => Promise<FichePdf>) {
  return async (
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
  ): Promise<Response> => {
    const { id } = await params;
    const n = idDe(id);
    if (!n) return pasTrouve();
    const user = await requireUser();
    try {
      const fiche = await construire(user, n);
      if (!fiche) return pasTrouve();
      return reponsePdf(fiche.octets, fiche.filename);
    } catch (e) {
      if (e instanceof ApiAuthError) return new Response("Forbidden", { status: e.statut });
      throw e;
    }
  };
}
