import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /software/shares/<share_id>/delete */
export async function POST(req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const shareId = idDe((await params).shareId);
  if (!shareId) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("software");
    const partage = await prisma.softwareShare.findUnique({ where: { id: shareId } });
    if (!partage) return pasTrouve();
    await prisma.softwareShare.delete({ where: { id: shareId } });
    await auditRecord("suppression partage reseau", partage.path, "inventory", user.username);
    return redirigerAvecMessage(
      `/inventory/logiciels/${partage.softwareId}`,
      "Dossier retiré",
      "success",
    );
  });
}
