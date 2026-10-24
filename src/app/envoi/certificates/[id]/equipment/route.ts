import { parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { enabled } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /certificates/<id>/equipment : rattache le certificat à un matériel (un seul, il remplace le précédent). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("certificates");
    if (!(await enabled("certificates"))) return pasTrouve();
    const cert = await prisma.certificate.findUnique({ where: { id } });
    if (!cert) return pasTrouve();
    const retour = `/certificates/${id}#liaisons`;
    const eid = parseInt_(form.get("equipment_id"), null) ?? 0;
    const e = eid ? await prisma.equipment.findUnique({ where: { id: eid } }) : null;
    if (!e?.isActive) return redirigerAvecMessage(retour, "Choisissez un matériel.", "danger");
    if (cert.equipmentId === e.id)
      return redirigerAvecMessage(retour, "Ce matériel est déjà associé.", "warning");
    await prisma.certificate.update({ where: { id }, data: { equipmentId: e.id } });
    await auditRecord(
      "materiel associe",
      `${cert.serviceName} <- ${e.name}`,
      "certificates",
      user.username,
    );
    return redirigerAvecMessage(retour, "Matériel associé", "success");
  });
}
