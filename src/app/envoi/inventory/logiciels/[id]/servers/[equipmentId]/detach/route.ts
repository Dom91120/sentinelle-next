import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import {
  idDe,
  pasTrouve,
  redirection,
  redirigerAvecMessage,
  traiterFormulaire,
} from "@/server/http";

/** POST /software/<id>/servers/<equipment_id>/detach : retire le LIEN entre le logiciel et un serveur. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; equipmentId: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  const eid = idDe(p.equipmentId);
  if (!id || !eid) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("software");
    const item = await prisma.software.findUnique({ where: { id } });
    if (!item) return pasTrouve();
    const retour = `/inventory/logiciels/${id}#liaisons`;
    const lien = await prisma.softwareEquipment.findUnique({
      where: { softwareId_equipmentId: { softwareId: id, equipmentId: eid } },
      include: { equipment: true },
    });
    if (!lien) return redirection(retour);
    await prisma.softwareEquipment.delete({
      where: { softwareId_equipmentId: { softwareId: id, equipmentId: eid } },
    });
    await auditRecord(
      "serveur retire",
      `${item.name} -/- ${lien.equipment.name}`,
      "inventory",
      user.username,
    );
    return redirigerAvecMessage(retour, "Serveur retiré", "success");
  });
}
