import { champ } from "@/lib/forms-util";
import { validRoleNames } from "@/modules/users/server";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /users/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const admin = await requireAdmin();
    const username = champ(form, "username");
    const email = champ(form, "email");
    const password = typeof form.get("password") === "string" ? (form.get("password") as string) : "";
    const confirm = typeof form.get("password_confirm") === "string" ? (form.get("password_confirm") as string) : "";
    const role = champ(form, "role") || "viewer";
    const retour = "/users/create";
    if (!(await validRoleNames()).has(role)) return redirigerAvecMessage(retour, "Role invalide.", "danger");
    if (await prisma.user.findFirst({ where: { username } })) return redirigerAvecMessage(retour, "Ce nom d'utilisateur existe deja", "danger");
    if (await prisma.user.findFirst({ where: { email } })) return redirigerAvecMessage(retour, "Cet email existe deja", "danger");
    const minlen = admin.settings.PASSWORD_MIN_LENGTH || 8;
    if (password.length < minlen) return redirigerAvecMessage(retour, `Le mot de passe doit contenir au moins ${minlen} caracteres`, "danger");
    if (password !== confirm) return redirigerAvecMessage(retour, "Les deux mots de passe ne correspondent pas.", "danger");
    const u = await prisma.user.create({ data: { username, displayUsername: username, email, name: username, role, authSource: "local" } });
    await poserMotDePasse(u.id, password);
    await auditRecord("creation utilisateur", `${username} (role ${role})`, "utilisateurs", admin.username);
    return redirigerAvecMessage("/users", `Utilisateur ${username} cree avec succes`, "success");
  });
}
