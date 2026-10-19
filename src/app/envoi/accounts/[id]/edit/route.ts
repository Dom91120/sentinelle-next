import { depuisFormulaire } from "@/modules/accounts/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /accounts/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    await requireEdit("accounts");
    const existant = await prisma.account.findUnique({ where: { id } });
    if (!existant) return pasTrouve();
    const data = await depuisFormulaire(form);
    if (!data) return redirigerAvecMessage(`/accounts/${id}/edit`, "Le service et l'identifiant sont obligatoires.", "danger");
    await prisma.account.update({ where: { id }, data });
    invalidateNavCounts();
    return redirigerAvecMessage(`/accounts/${id}`, "Compte modifié avec succès", "success");
  });
}
