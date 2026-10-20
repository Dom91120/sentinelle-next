import { depuisFormulaire, poserRattachements } from "@/modules/software/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { enabledIn } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /software/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    const item = await prisma.software.findUnique({ where: { id } });
    if (!item) return pasTrouve();
    const data = depuisFormulaire(form, enabledIn(user.settings, "gdpr"));
    if (!data.name)
      return redirigerAvecMessage(
        `/inventory/logiciels/${id}/edit`,
        "Le nom du logiciel est obligatoire.",
        "danger",
      );
    await prisma.software.update({ where: { id }, data });
    // Les revues de droits affichent le nom du logiciel : elles le suivent.
    await prisma.accessReview.updateMany({
      where: { softwareId: id },
      data: { application: data.name as string },
    });
    await poserRattachements(id, form);
    await auditRecord("modification logiciel", data.name as string, "inventory", user.username);
    invalidateNavCounts();
    return redirigerAvecMessage(`/inventory/logiciels/${id}`, "Logiciel modifié", "success");
  });
}
