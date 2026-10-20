import { champ } from "@/lib/forms-util";
import { adminRoleNames, adminUserCount, validRoleNames } from "@/modules/users/server";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /users/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return traiterFormulaire(req, async (form) => {
    const admin = await requireAdmin();
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return pasTrouve();
    const retour = `/users/${id}/edit`;
    const email = champ(form, "email");
    const newRole = champ(form, "role") || "viewer";
    if (!(await validRoleNames()).has(newRole))
      return redirigerAvecMessage(retour, "Role invalide.", "danger");
    if (newRole !== user.role) {
      if (user.id === admin.id)
        return redirigerAvecMessage(
          retour,
          "Vous ne pouvez pas modifier votre propre role.",
          "danger",
        );
      const admins = await adminRoleNames();
      if (admins.has(user.role) && !admins.has(newRole) && (await adminUserCount()) <= 1)
        return redirigerAvecMessage(
          retour,
          "Impossible de retirer le dernier administrateur.",
          "danger",
        );
    }
    const newPassword =
      typeof form.get("password") === "string" ? (form.get("password") as string) : "";
    const confirm =
      typeof form.get("password_confirm") === "string"
        ? (form.get("password_confirm") as string)
        : "";
    const minlen = admin.settings.PASSWORD_MIN_LENGTH || 8;
    if (newPassword && newPassword.length < minlen)
      return redirigerAvecMessage(
        retour,
        `Le mot de passe doit contenir au moins ${minlen} caracteres`,
        "danger",
      );
    if (newPassword && newPassword !== confirm)
      return redirigerAvecMessage(retour, "Les deux mots de passe ne correspondent pas.", "danger");
    await prisma.user.update({ where: { id }, data: { email, role: newRole } });
    if (newPassword) await poserMotDePasse(id, newPassword);
    await auditRecord(
      "modification utilisateur",
      `${user.username} (role ${newRole})`,
      "utilisateurs",
      admin.username,
    );
    return redirigerAvecMessage("/users", `Utilisateur ${user.username} modifie`, "success");
  });
}
