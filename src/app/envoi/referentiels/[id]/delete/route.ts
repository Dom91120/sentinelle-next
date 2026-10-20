import { REFERENTIAL_KINDS } from "@/lib/constantes";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/referentiels";

/**
 * POST /referentiels/<id>/delete : retire la valeur de la liste. Les fiches qui la
 * portaient gardent leur référence (l'écran affiche simplement un vide).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async () => {
      const admin = await requireAdmin();
      const item = await prisma.referential.findUnique({ where: { id } });
      if (!item) return pasTrouve();
      await prisma.referential.delete({ where: { id } });
      await auditRecord(
        "suppression referentiel",
        `${REFERENTIAL_KINDS[item.kind] ?? item.kind} : ${item.label}`,
        "preferences",
        admin.username,
      );
      return redirigerAvecMessage(RETOUR, "Valeur supprimée", "success");
    },
    RETOUR,
  );
}
