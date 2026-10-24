import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { enabled } from "@/server/features";
import { requireEdit } from "@/server/guards";
import {
  idDe,
  pasTrouve,
  redirection,
  redirigerAvecMessage,
  traiterFormulaire,
} from "@/server/http";

/** POST /software/<id>/certificates/<certificate_id>/detach : retire le LIEN entre le logiciel et un certificat. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; certificateId: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  const cid = idDe(p.certificateId);
  if (!id || !cid) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("software");
    if (!(await enabled("certificates"))) return pasTrouve();
    const item = await prisma.software.findUnique({ where: { id } });
    if (!item) return pasTrouve();
    const retour = `/inventory/logiciels/${id}#liaisons`;
    const lien = await prisma.softwareCertificate.findUnique({
      where: { softwareId_certificateId: { softwareId: id, certificateId: cid } },
      include: { certificate: true },
    });
    if (!lien) return redirection(retour);
    await prisma.softwareCertificate.delete({
      where: { softwareId_certificateId: { softwareId: id, certificateId: cid } },
    });
    await auditRecord(
      "certificat retire",
      `${item.name} -/- ${lien.certificate.serviceName}`,
      "inventory",
      user.username,
    );
    return redirigerAvecMessage(retour, "Certificat retiré", "success");
  });
}
