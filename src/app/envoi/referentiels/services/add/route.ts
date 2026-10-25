import { champ, champOuNull, parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/preferences#secReferentiels";

/** POST /referentiels/services/add */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const name = champ(form, "name");
      if (!name) return redirigerAvecMessage(RETOUR, "Indiquez le nom du service.", "danger");
      if (await prisma.userService.findUnique({ where: { name } }))
        return redirigerAvecMessage(RETOUR, `Le service « ${name} » existe déjà.`, "warning");
      await prisma.userService.create({
        data: {
          name,
          contactName: champOuNull(form, "contact_name"),
          contactEmail: champOuNull(form, "contact_email"),
          contactPhone: champOuNull(form, "contact_phone"),
          position: parseInt_(form.get("position"), 0, 0) ?? 0,
        },
      });
      await auditRecord("creation service utilisateur", name, "preferences", admin.username);
      return redirigerAvecMessage(RETOUR, "Service ajouté", "success");
    },
    RETOUR,
  );
}
