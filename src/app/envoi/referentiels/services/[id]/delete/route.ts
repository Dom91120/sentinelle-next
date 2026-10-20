import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/referentiels";

/**
 * POST /referentiels/services/<id>/delete : désactive plutôt que supprimer. Le service
 * disparaît des listes déroulantes, mais les fiches qui le nommaient continuent de l'afficher.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async () => {
      const admin = await requireAdmin();
      const sv = await prisma.userService.findUnique({ where: { id } });
      if (!sv) return pasTrouve();
      await prisma.userService.update({ where: { id }, data: { isActive: false } });
      await auditRecord("suppression service utilisateur", sv.name, "preferences", admin.username);
      return redirigerAvecMessage(RETOUR, "Service retiré des listes", "success");
    },
    RETOUR,
  );
}
