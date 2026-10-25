import { REFERENTIAL_KINDS } from "@/lib/constantes";
import { champ } from "@/lib/forms-util";
import { portee } from "@/modules/referentiels/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/preferences#secReferentiels";

/** POST /referentiels/<id>/edit : renomme une valeur et change son type de fiche. Les fiches qui la portent suivent (lien par identifiant). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const item = await prisma.referential.findUnique({ where: { id } });
      if (!item) return pasTrouve();
      const label = champ(form, "label");
      if (!label) return redirigerAvecMessage(RETOUR, "Indiquez un libellé.", "danger");
      // Le type n'est envoyé que pour les listes qui en ont ; absent, il reste tel quel.
      const scope = form.has("scope") ? portee(item.kind, champ(form, "scope")) : item.scope;
      if (label === item.label && scope === item.scope)
        return redirigerAvecMessage(RETOUR, "Valeur inchangée.", "info");
      // Le doublon est REFUSÉ : deux libellés identiques dans une liste ne se distinguent pas.
      if (
        await prisma.referential.findFirst({ where: { kind: item.kind, label, id: { not: id } } })
      )
        return redirigerAvecMessage(
          RETOUR,
          `« ${label} » existe déjà dans cette liste.`,
          "warning",
        );
      await prisma.referential.update({ where: { id }, data: { label, scope } });
      const type = scope !== item.scope ? ` (${item.scope ?? "tous"} → ${scope ?? "tous"})` : "";
      await auditRecord(
        "modification referentiel",
        `${REFERENTIAL_KINDS[item.kind] ?? item.kind} : ${item.label} → ${label}${type}`,
        "preferences",
        admin.username,
      );
      return redirigerAvecMessage(RETOUR, "Valeur modifiée", "success");
    },
    RETOUR,
  );
}
