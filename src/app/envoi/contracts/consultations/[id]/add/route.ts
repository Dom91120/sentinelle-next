import { champ, parseDate } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /contracts/consultations/<software_id>/add */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const softwareId = idDe((await params).id);
  if (!softwareId) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("contracts");
    await requireFeature("quotes");
    const sw = await prisma.software.findUnique({ where: { id: softwareId } });
    if (!sw) return pasTrouve();
    const retour = `/inventory/logiciels/${softwareId}`;
    const subject = champ(form, "subject");
    if (!subject)
      return redirigerAvecMessage(retour, "Indiquez l'objet de la consultation.", "danger");
    const notes = form.get("notes");
    await prisma.consultation.create({
      data: {
        softwareId,
        subject,
        date: parseDate(form.get("date")),
        notes: typeof notes === "string" && notes ? notes : null,
      },
    });
    await auditRecord(
      "creation consultation",
      `${sw.name} : ${subject}`,
      "contrats",
      user.username,
    );
    return redirigerAvecMessage(retour, "Consultation ajoutée", "success");
  });
}
