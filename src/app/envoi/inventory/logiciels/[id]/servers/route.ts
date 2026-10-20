import { parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /software/<id>/servers : associe un serveur au logiciel. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    const item = await prisma.software.findUnique({ where: { id } });
    if (!item) return pasTrouve();
    const retour = `/inventory/logiciels/${id}#liaisons`;
    const eid = parseInt_(form.get("equipment_id"), null) ?? 0;
    const e = eid ? await prisma.equipment.findUnique({ where: { id: eid } }) : null;
    if (!e || !e.isActive) return redirigerAvecMessage(retour, "Choisissez un serveur.", "danger");
    const deja = await prisma.softwareEquipment.findUnique({ where: { softwareId_equipmentId: { softwareId: id, equipmentId: e.id } } });
    if (deja) return redirigerAvecMessage(retour, "Ce serveur est déjà associé.", "warning");
    await prisma.softwareEquipment.create({ data: { softwareId: id, equipmentId: e.id } });
    await prisma.software.update({ where: { id }, data: { noServer: false } });
    await auditRecord("serveur associe", `${item.name} <- ${e.name}`, "inventory", user.username);
    return redirigerAvecMessage(retour, "Serveur associé", "success");
  });
}
