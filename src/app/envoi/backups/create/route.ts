import { depuisFormulaire, serviceName } from "@/modules/backups/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /backups/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("backups");
    const nom = serviceName(form);
    if (!nom) return redirigerAvecMessage("/backups/create", "Le nom du service est obligatoire.", "danger");
    const b = await prisma.backup.create({ data: { serviceName: nom, ...(await depuisFormulaire(form)) } });
    await prisma.backupHistory.create({ data: { backupId: b.id, action: "creation", comment: `Backup cree : ${b.serviceName}`, performedBy: user.username } });
    invalidateNavCounts();
    return redirigerAvecMessage("/backups", "Backup ajoute avec succes", "success");
  });
}
