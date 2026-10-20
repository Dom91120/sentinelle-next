import { champ } from "@/lib/forms-util";
import { depuisFormulaire } from "@/modules/tests/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /tests/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    await requireEdit("tests");
    const test = await prisma.testTask.findUnique({ where: { id } });
    if (!test) return pasTrouve();
    const name = champ(form, "name");
    if (!name) return redirigerAvecMessage(`/tests/${id}/edit`, "Le nom du test est obligatoire.", "danger");
    await prisma.testTask.update({ where: { id }, data: { name, ...depuisFormulaire(form) } });
    invalidateNavCounts();
    return redirigerAvecMessage(`/tests/${id}`, "Test modifié avec succès", "success");
  });
}
