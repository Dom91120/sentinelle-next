import { depuisFormulaire } from "@/modules/certificates/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /certificates/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    await requireEdit("certificates");
    const cert = await prisma.certificate.findUnique({ where: { id }, include: { service: true } });
    if (!cert) return pasTrouve();
    const resultat = await depuisFormulaire(cert.kind || "tls", form, cert);
    if ("erreur" in resultat) return redirigerAvecMessage(`/certificates/${id}/edit`, resultat.erreur, "danger");
    await prisma.certificate.update({ where: { id }, data: resultat.data });
    invalidateNavCounts();
    return redirigerAvecMessage(`/certificates/${id}`, "Certificat modifié avec succès", "success");
  });
}
