import { REFERENTIAL_KINDS } from "@/lib/constantes";
import { champ, parseInt_ } from "@/lib/forms-util";
import { portee } from "@/modules/referentiels/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/preferences#secReferentiels";

/** POST /referentiels/add */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const kind = champ(form, "kind");
      const label = champ(form, "label");
      if (!(kind in REFERENTIAL_KINDS) || !label)
        return redirigerAvecMessage(RETOUR, "Indiquez un libellé.", "danger");
      // Le doublon est REFUSÉ plutôt qu'ignoré : deux libellés identiques dans une liste déroulante ne se distinguent pas.
      if (await prisma.referential.findFirst({ where: { kind, label } }))
        return redirigerAvecMessage(
          RETOUR,
          `« ${label} » existe déjà dans cette liste.`,
          "warning",
        );
      await prisma.referential.create({
        data: {
          kind,
          label,
          position: parseInt_(form.get("position"), 0, 0) ?? 0,
          scope: portee(kind, champ(form, "scope")),
        },
      });
      await auditRecord(
        "ajout referentiel",
        `${REFERENTIAL_KINDS[kind]} : ${label}`,
        "preferences",
        admin.username,
      );
      return redirigerAvecMessage(RETOUR, "Valeur ajoutée", "success");
    },
    RETOUR,
  );
}
