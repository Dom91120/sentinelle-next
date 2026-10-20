import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /contracts/consultations/<consultation_id>/delete (les devis suivent) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const consultationId = idDe((await params).id);
  if (!consultationId) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("contracts");
    await requireFeature("quotes");
    const cons = await prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!cons) return pasTrouve();
    await prisma.consultation.delete({ where: { id: consultationId } });
    await auditRecord("suppression consultation", cons.subject, "contrats", user.username);
    return redirigerAvecMessage(
      `/inventory/logiciels/${cons.softwareId}`,
      "Consultation supprimée",
      "success",
    );
  });
}
