import { depuisFormulaire } from "@/modules/accounts/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /accounts/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("accounts");
    const data = await depuisFormulaire(form);
    if (!data)
      return redirigerAvecMessage(
        "/accounts/create",
        "Le service et l'identifiant sont obligatoires.",
        "danger",
      );
    const a = await prisma.account.create({ data });
    await prisma.accountHistory.create({
      data: {
        accountId: a.id,
        action: "creation",
        comment: `Compte créé : ${a.serviceName} (${a.username})`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/accounts", "Compte ajouté avec succès", "success");
  });
}
