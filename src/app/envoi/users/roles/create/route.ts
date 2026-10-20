import { PERMISSION_CATEGORIES } from "@/lib/constantes";
import { champ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /users/roles/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const admin = await requireAdmin();
    const name = champ(form, "name").toLowerCase();
    if (!name) return redirigerAvecMessage("/users/roles", "Nom de role requis.", "danger");
    if (await prisma.role.findUnique({ where: { name } }))
      return redirigerAvecMessage("/users/roles", "Ce role existe deja.", "danger");
    await prisma.role.create({
      data: {
        name,
        description: champ(form, "description"),
        isAdmin: false,
        permissions: Object.fromEntries(PERMISSION_CATEGORIES.map((c) => [c, 0])),
      },
    });
    await auditRecord("creation role", name, "roles", admin.username);
    return redirigerAvecMessage("/users/roles", `Role « ${name} » cree.`, "success");
  });
}
