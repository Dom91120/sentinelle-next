import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /agenda/ics-token : génère, régénère ou désactive le jeton d'abonnement ICS. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireUser();
    if (form.get("action") === "disable") {
      await prisma.user.update({ where: { id: user.id }, data: { icsToken: null } });
      return redirigerAvecMessage(
        "/agenda",
        "Lien d'abonnement désactivé : les calendriers abonnés ne seront plus alimentés.",
        "success",
      );
    }
    const regen = user.icsToken !== null;
    await prisma.user.update({
      where: { id: user.id },
      data: { icsToken: randomBytes(32).toString("base64url") },
    });
    return redirigerAvecMessage(
      "/agenda",
      `Nouveau lien d'abonnement généré.${regen ? " L'ancien lien ne fonctionne plus." : ""}`,
      "success",
    );
  });
}
