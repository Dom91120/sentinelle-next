import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /users/roles/<id>/delete */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const admin = await requireAdmin();
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return pasTrouve();
    if (["admin", "editor", "viewer"].includes(role.name))
      return redirigerAvecMessage(
        "/users/roles",
        "Les roles par defaut ne peuvent pas etre supprimes.",
        "danger",
      );
    if ((await prisma.user.count({ where: { role: role.name } })) > 0)
      return redirigerAvecMessage(
        "/users/roles",
        "Role utilise par des utilisateurs : reassignez-les d abord.",
        "danger",
      );
    await prisma.role.delete({ where: { id } });
    await auditRecord("suppression role", role.name, "roles", admin.username);
    return redirigerAvecMessage("/users/roles", "Role supprime.", "success");
  });
}
