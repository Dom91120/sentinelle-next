import { champ, champOuNull } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /software/<id>/shares/add : rattache un dossier du partage réseau. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    const sw = await prisma.software.findUnique({ where: { id } });
    if (!sw) return pasTrouve();
    const retour = `/inventory/logiciels/${id}`;
    const chemin = champ(form, "path");
    if (!chemin) return redirigerAvecMessage(retour, "Indiquez le chemin du dossier.", "danger");
    if (await prisma.softwareShare.findFirst({ where: { softwareId: id, path: chemin } }))
      return redirigerAvecMessage(retour, "Ce dossier est déjà rattaché à cette fiche.", "warning");
    await prisma.softwareShare.create({
      data: { softwareId: id, path: chemin.slice(0, 512), label: champOuNull(form, "label") },
    });
    await auditRecord("ajout partage reseau", `${sw.name} : ${chemin}`, "inventory", user.username);
    return redirigerAvecMessage(retour, "Dossier ajouté", "success");
  });
}
