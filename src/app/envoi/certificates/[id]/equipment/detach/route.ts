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

/** POST /certificates/<id>/equipment/detach : détache le certificat de son matériel (le matériel reste). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("certificates");
    if (!(await enabled("certificates"))) return pasTrouve();
    const cert = await prisma.certificate.findUnique({
      where: { id },
      include: { equipment: true },
    });
    if (!cert) return pasTrouve();
    const retour = `/certificates/${id}#liaisons`;
    if (!cert.equipment) return redirection(retour);
    await prisma.certificate.update({ where: { id }, data: { equipmentId: null } });
    await auditRecord(
      "materiel retire",
      `${cert.serviceName} -/- ${cert.equipment.name}`,
      "certificates",
      user.username,
    );
    return redirigerAvecMessage(retour, "Matériel retiré", "success");
  });
}
