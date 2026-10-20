import { scanDomain } from "@/modules/domains/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /domains/<id>/scan-ct : scan manuel des journaux de Certificate Transparency (crt.sh). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("domains");
    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) return pasTrouve();
    const res = await scanDomain(domain, user.username);
    const retour = `/domains/${id}`;
    if (res.error)
      return redirigerAvecMessage(retour, `Scan CT impossible : ${res.error}`, "danger");
    if (res.baseline)
      return redirigerAvecMessage(
        retour,
        `Ligne de base CT etablie : ${res.baseline} certificat(s) enregistre(s) (pas d'alerte sur l'historique).`,
        "info",
      );
    if (res.new.length)
      return redirigerAvecMessage(
        retour,
        `${res.new.length} nouveau(x) certificat(s) detecte(s) dans les journaux CT — a verifier.`,
        "warning",
      );
    return redirigerAvecMessage(
      retour,
      "Aucun nouveau certificat dans les journaux CT.",
      "success",
    );
  });
}
