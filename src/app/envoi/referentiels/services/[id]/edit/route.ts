import { champ, champOuNull } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/referentiels";

/** POST /referentiels/services/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const sv = await prisma.userService.findUnique({ where: { id } });
      if (!sv) return pasTrouve();
      const name = champ(form, "name");
      const maj = await prisma.userService.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          contactName: champOuNull(form, "contact_name"),
          contactEmail: champOuNull(form, "contact_email"),
          contactPhone: champOuNull(form, "contact_phone"),
        },
      });
      await auditRecord(
        "modification service utilisateur",
        maj.name,
        "preferences",
        admin.username,
      );
      return redirigerAvecMessage(RETOUR, "Service modifié", "success");
    },
    RETOUR,
  );
}
