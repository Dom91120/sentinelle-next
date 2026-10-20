import { champ, champOuNull } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /software/shares/<share_id>/edit : corrige le libellé ou le chemin d'un dossier rattaché. */
export async function POST(req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const shareId = idDe((await params).shareId);
  if (!shareId) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    const partage = await prisma.softwareShare.findUnique({
      where: { id: shareId },
      include: { software: { select: { name: true } } },
    });
    if (!partage) return pasTrouve();
    const retour = `/inventory/logiciels/${partage.softwareId}`;
    const chemin = champ(form, "path").slice(0, 512);
    if (!chemin) return redirigerAvecMessage(retour, "Indiquez le chemin du dossier.", "danger");
    const doublon = await prisma.softwareShare.findFirst({
      where: { softwareId: partage.softwareId, path: chemin, id: { not: shareId } },
    });
    if (doublon)
      return redirigerAvecMessage(retour, "Ce dossier est déjà rattaché à cette fiche.", "warning");
    await prisma.softwareShare.update({
      where: { id: shareId },
      data: { path: chemin, label: champOuNull(form, "label") },
    });
    await auditRecord(
      "modification partage reseau",
      `${partage.software.name} : ${partage.path} → ${chemin}`,
      "inventory",
      user.username,
    );
    return redirigerAvecMessage(retour, "Dossier modifié", "success");
  });
}
