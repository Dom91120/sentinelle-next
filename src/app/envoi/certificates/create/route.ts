import { certificateLabel } from "@/lib/statuts";
import { depuisFormulaire, kindDe } from "@/modules/certificates/server";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /certificates/create */
export async function POST(req: Request) {
  const kindUrl = new URL(req.url).searchParams.get("kind");
  return traiterFormulaire(req, async (form) => {
    await requireFeature("certificates");
    const user = await requireEdit("certificates");
    const kind = kindDe(form.get("kind") ?? kindUrl ?? undefined);
    const resultat = await depuisFormulaire(kind, form, null);
    if ("erreur" in resultat)
      return redirigerAvecMessage(`/certificates/create?kind=${kind}`, resultat.erreur, "danger");
    const c = await prisma.certificate.create({ data: resultat.data as never });
    await prisma.certificateHistory.create({
      data: {
        certificateId: c.id,
        action: "creation",
        comment: `Certificat créé : ${certificateLabel(c)}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/certificates", "Certificat ajouté avec succès", "success");
  });
}
