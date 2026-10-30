import { coche } from "@/lib/forms-util";
import { depuisFormulaire, enregistrerSaisie, nomDe } from "@/modules/updates/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /updates/<id>/edit — enregistre la fiche ; l'interrupteur « Mise à jour effectuée » la
 * marque à jour dans le même envoi. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("updates");
    const update = await prisma.systemUpdate.findUnique({ where: { id }, select: { id: true } });
    if (!update) return pasTrouve();
    const name = nomDe(form);
    if (!name)
      return redirigerAvecMessage(`/updates/${id}#details`, "Le nom est obligatoire.", "danger");
    const effectuee = coche(form, "done");
    await enregistrerSaisie(id, await depuisFormulaire(form, name), effectuee, user.username);
    invalidateNavCounts();
    return redirigerAvecMessage(
      `/updates/${id}`,
      effectuee ? "Mise à jour effectuée" : "Mise à jour modifiée",
      "success",
    );
  });
}
