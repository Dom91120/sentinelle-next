import { adminRoleNames, adminUserCount } from "@/modules/users/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /users/<id>/delete */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return traiterFormulaire(req, async () => {
    const admin = await requireAdmin();
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return pasTrouve();
    if (user.username === "admin") return redirigerAvecMessage("/users", "Impossible de supprimer l'administrateur principal", "danger");
    if (user.id === admin.id) return redirigerAvecMessage("/users", "Vous ne pouvez pas supprimer votre propre compte", "danger");
    if ((await adminRoleNames()).has(user.role) && (await adminUserCount()) <= 1) return redirigerAvecMessage("/users", "Impossible de supprimer le dernier administrateur.", "danger");
    await prisma.user.delete({ where: { id } });
    await auditRecord("suppression utilisateur", user.username, "utilisateurs", admin.username);
    return redirigerAvecMessage("/users", `Utilisateur ${user.username} supprime`, "success");
  });
}
