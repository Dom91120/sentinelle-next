import { parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { enabled } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /software/<id>/certificates : associe un certificat au logiciel. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    if (!(await enabled("certificates"))) return pasTrouve();
    const item = await prisma.software.findUnique({ where: { id } });
    if (!item) return pasTrouve();
    const retour = `/inventory/logiciels/${id}#liaisons`;
    const cid = parseInt_(form.get("certificate_id"), null) ?? 0;
    const c = cid ? await prisma.certificate.findUnique({ where: { id: cid } }) : null;
    if (!c?.isActive) return redirigerAvecMessage(retour, "Choisissez un certificat.", "danger");
    const deja = await prisma.softwareCertificate.findUnique({
      where: { softwareId_certificateId: { softwareId: id, certificateId: c.id } },
    });
    if (deja) return redirigerAvecMessage(retour, "Ce certificat est déjà associé.", "warning");
    await prisma.softwareCertificate.create({ data: { softwareId: id, certificateId: c.id } });
    await auditRecord(
      "certificat associe",
      `${item.name} <- ${c.serviceName}`,
      "inventory",
      user.username,
    );
    return redirigerAvecMessage(retour, "Certificat associé", "success");
  });
}
