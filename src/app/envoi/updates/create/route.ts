import { depuisFormulaire, nomDe } from "@/modules/updates/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /updates/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("updates");
    const name = nomDe(form);
    if (!name) return redirigerAvecMessage("/updates/create", "Le nom est obligatoire.", "danger");
    const u = await prisma.systemUpdate.create({ data: await depuisFormulaire(form, name) });
    await prisma.updateHistory.create({
      data: {
        updateId: u.id,
        action: "creation",
        comment: `Mise à jour créée : ${u.name}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/updates", "Mise à jour ajoutée", "success");
  });
}
