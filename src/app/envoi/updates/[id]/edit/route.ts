import { depuisFormulaire, nomDe } from "@/modules/updates/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /updates/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    await requireEdit("updates");
    const update = await prisma.systemUpdate.findUnique({ where: { id } });
    if (!update) return pasTrouve();
    const name = nomDe(form);
    if (!name)
      return redirigerAvecMessage(`/updates/${id}/edit`, "Le nom est obligatoire.", "danger");
    await prisma.systemUpdate.update({ where: { id }, data: await depuisFormulaire(form, name) });
    invalidateNavCounts();
    return redirigerAvecMessage(`/updates/${id}`, "Mise à jour modifiée", "success");
  });
}
