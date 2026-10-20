import { depuisFormulaire, serviceName } from "@/modules/backups/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /backups/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    await requireEdit("backups");
    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) return pasTrouve();
    const nom = serviceName(form);
    if (!nom) return redirigerAvecMessage(`/backups/${id}/edit`, "Le nom du service est obligatoire.", "danger");
    await prisma.backup.update({ where: { id }, data: { serviceName: nom, ...(await depuisFormulaire(form)) } });
    invalidateNavCounts();
    return redirigerAvecMessage(`/backups/${id}`, "Backup modifie avec succes", "success");
  });
}
