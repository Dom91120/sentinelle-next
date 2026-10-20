import { PERMISSION_CATEGORIES } from "@/lib/constantes";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /users/roles/<id>/save */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const admin = await requireAdmin();
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return pasTrouve();
    const description =
      typeof form.get("description") === "string"
        ? (form.get("description") as string)
        : role.description;
    let permissions = role.permissions;
    if (!role.isAdmin) {
      const perms: Record<string, number> = {};
      for (const c of PERMISSION_CATEGORIES) {
        const lvl = Number.parseInt(String(form.get(`perm_${c}`) ?? "0"), 10);
        perms[c] = Math.max(0, Math.min(3, Number.isNaN(lvl) ? 0 : lvl));
      }
      permissions = perms;
    }
    await prisma.role.update({
      where: { id },
      data: { description, permissions: permissions ?? undefined },
    });
    await auditRecord("modification role", role.name, "roles", admin.username);
    return redirigerAvecMessage("/users/roles", `Role « ${role.name} » enregistre`, "success");
  });
}
