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

/** POST /certificates/<id>/software/<software_id>/detach : retire le LIEN entre le certificat et un logiciel. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; softwareId: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  const sid = idDe(p.softwareId);
  if (!id || !sid) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("certificates");
    if (!(await enabled("certificates"))) return pasTrouve();
    const cert = await prisma.certificate.findUnique({ where: { id } });
    if (!cert) return pasTrouve();
    const retour = `/certificates/${id}#liaisons`;
    const lien = await prisma.softwareCertificate.findUnique({
      where: { softwareId_certificateId: { softwareId: sid, certificateId: id } },
      include: { software: true },
    });
    if (!lien) return redirection(retour);
    await prisma.softwareCertificate.delete({
      where: { softwareId_certificateId: { softwareId: sid, certificateId: id } },
    });
    await auditRecord(
      "certificat retire",
      `${lien.software.name} -/- ${cert.serviceName}`,
      "certificates",
      user.username,
    );
    return redirigerAvecMessage(retour, "Logiciel retiré", "success");
  });
}
