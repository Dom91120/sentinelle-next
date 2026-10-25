import { REFERENTIAL_KINDS, REFERENTIAL_SCOPES } from "@/lib/constantes";
import { champ } from "@/lib/forms-util";
import { portee, scopeLabel } from "@/modules/referentiels/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/preferences#secReferentiels";

/** POST /referentiels/<id>/scope : change le type de fiche auquel une valeur est réservée. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const item = await prisma.referential.findUnique({ where: { id } });
      if (!item) return pasTrouve();
      if (!(item.kind in REFERENTIAL_SCOPES))
        return redirigerAvecMessage(RETOUR, "Cette liste ne distingue pas de type.", "warning");
      const scope = portee(item.kind, champ(form, "scope"));
      await prisma.referential.update({ where: { id }, data: { scope } });
      await auditRecord(
        "portee referentiel",
        `${REFERENTIAL_KINDS[item.kind]} : ${item.label} -> ${scopeLabel(item.kind, scope)}`,
        "preferences",
        admin.username,
      );
      return redirigerAvecMessage(RETOUR, "Valeur mise à jour", "success");
    },
    RETOUR,
  );
}
