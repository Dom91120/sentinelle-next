import { parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { enabled } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /certificates/<id>/software : associe un logiciel au certificat. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("certificates");
    if (!(await enabled("certificates"))) return pasTrouve();
    const cert = await prisma.certificate.findUnique({ where: { id } });
    if (!cert) return pasTrouve();
    const retour = `/certificates/${id}#liaisons`;
    const sid = parseInt_(form.get("software_id"), null) ?? 0;
    const s = sid ? await prisma.software.findUnique({ where: { id: sid } }) : null;
    if (!s?.isActive) return redirigerAvecMessage(retour, "Choisissez un logiciel.", "danger");
    const deja = await prisma.softwareCertificate.findUnique({
      where: { softwareId_certificateId: { softwareId: s.id, certificateId: id } },
    });
    if (deja) return redirigerAvecMessage(retour, "Ce logiciel est déjà associé.", "warning");
    await prisma.softwareCertificate.create({ data: { softwareId: s.id, certificateId: id } });
    await auditRecord(
      "certificat associe",
      `${s.name} <- ${cert.serviceName}`,
      "certificates",
      user.username,
    );
    return redirigerAvecMessage(retour, "Logiciel associé", "success");
  });
}
