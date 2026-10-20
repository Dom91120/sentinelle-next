import { createOTP } from "@better-auth/utils/otp";
import { champ } from "@/lib/forms-util";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/guards";
import { redirection, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { verifyPassword } from "@/server/password";
import {
  cancelEnrolement,
  initTwoFactor,
  normaliserCode,
  pendingEnrolement,
  resetTwoFactor,
} from "@/server/two-factor";

/** Le mot de passe local correspond-il ? (`current_user.check_password`) */
async function motDePasseValide(userId: string, password: string): Promise<boolean> {
  const cred = await prisma.authAccount.findFirst({ where: { userId, providerId: "credential" } });
  return Boolean(cred?.password) && (await verifyPassword(cred?.password ?? "", password));
}

/** POST /profile (auth.profile) : mot de passe et second facteur de l'utilisateur connecté. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireUser();
      const action = champ(form, "action");

      if (action === "change_password") {
        const old = String(form.get("old_password") ?? "");
        const nouveau = String(form.get("new_password") ?? "");
        const confirm = String(form.get("confirm_password") ?? "");
        const min = user.settings.PASSWORD_MIN_LENGTH;
        if (!(await motDePasseValide(user.id, old)))
          return redirigerAvecMessage("/profile", "Mot de passe actuel incorrect", "danger");
        if (nouveau !== confirm)
          return redirigerAvecMessage(
            "/profile",
            "Les mots de passe ne correspondent pas",
            "danger",
          );
        if (nouveau.length < min)
          return redirigerAvecMessage(
            "/profile",
            `Le mot de passe doit contenir au moins ${min} caracteres`,
            "danger",
          );
        await poserMotDePasse(user.id, nouveau);
        await auditRecord("changement mot de passe", "", "securite", user.username);
        return redirigerAvecMessage("/profile", "Mot de passe modifie avec succes", "success");
      }

      if (action === "init_2fa") {
        await initTwoFactor(user.id, user.username);
        return redirection("/profile");
      }

      if (action === "cancel_2fa") {
        await cancelEnrolement(user.id);
        return redirection("/profile");
      }

      if (action === "confirm_2fa") {
        const pending = await pendingEnrolement(user.id, user.username);
        const code = normaliserCode(form.get("code"));
        const ok = pending
          ? await createOTP(pending.secret, { digits: 6, period: 30 }).verify(code, { window: 1 })
          : false;
        if (pending && ok) {
          await prisma.twoFactor.updateMany({
            where: { userId: user.id },
            data: { verified: true },
          });
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorEnabled: true, totpFailedCount: 0, totpLockedUntil: null },
          });
          await auditRecord("activation 2FA", "", "securite", user.username);
          return redirigerAvecMessage("/profile", "Double authentification activée.", "success");
        }
        return redirigerAvecMessage("/profile", "Code invalide, réessayez.", "danger");
      }

      if (action === "disable_2fa") {
        if (await motDePasseValide(user.id, String(form.get("password") ?? ""))) {
          await resetTwoFactor(user.id);
          await auditRecord("desactivation 2FA", "", "securite", user.username);
          return redirigerAvecMessage("/profile", "Double authentification désactivée.", "success");
        }
        return redirigerAvecMessage("/profile", "Mot de passe incorrect.", "danger");
      }

      return redirection("/profile");
    },
    "/profile",
  );
}
