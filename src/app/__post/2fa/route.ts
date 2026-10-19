import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { auditRecord } from "@/server/audit";
import { auth } from "@/server/auth";
import { safeNext } from "@/server/connexion";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { redirection, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { clearPending2fa, pending2fa } from "@/server/session-2fa";
import { normaliserCode } from "@/server/two-factor";

/** POST /2fa (auth.two_factor) : vérifie le code, avec le compteur d'essais EN BASE. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const pending = await pending2fa();
      if (!pending) return redirection("/login");
      const user = await prisma.user.findUnique({ where: { id: pending.uid } });
      if (!user || !user.twoFactorEnabled) {
        await clearPending2fa();
        return redirection("/login");
      }
      const cfg = await getSettings();
      const maxAttempts = cfg.LOGIN_MAX_ATTEMPTS;
      const lockoutMin = cfg.LOGIN_LOCKOUT_MINUTES;
      const now = new Date();
      const refuser = async () => {
        await clearPending2fa();
        return redirigerAvecMessage("/login", "Trop de tentatives. Reessayez plus tard.", "danger");
      };
      const locked = (u: { totpLockedUntil: Date | null }) => Boolean(u.totpLockedUntil && u.totpLockedUntil > now);
      if (locked(user)) return refuser();
      // L'essai est compté AVANT la vérification, d'un UPDATE atomique.
      const u2 = await prisma.user.update({
        where: { id: user.id },
        data: { totpFailedCount: { increment: 1 } },
      });
      if (locked(u2) || u2.totpFailedCount > maxAttempts) return refuser();

      const code = normaliserCode(form.get("code"));
      let ok = false;
      try {
        await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
        ok = true;
      } catch (e) {
        if (!(e instanceof APIError)) throw e;
        ok = false;
      }
      if (ok) {
        await prisma.user.update({ where: { id: user.id }, data: { totpFailedCount: 0, totpLockedUntil: null } });
        const next = safeNext(pending.next);
        await clearPending2fa();
        await auditRecord(`connexion (2FA)${pending.ldap ? " LDAP" : ""}`, "", "securite", user.username);
        return redirection(next ?? "/");
      }
      if (u2.totpFailedCount >= maxAttempts) {
        await prisma.user.update({
          where: { id: user.id },
          data: { totpFailedCount: 0, totpLockedUntil: new Date(now.getTime() + lockoutMin * 60000) },
        });
        await auditRecord("blocage 2FA", user.username, "securite", user.username);
        return refuser();
      }
      await auditRecord("echec 2FA", user.username, "securite", user.username);
      return redirigerAvecMessage("/2fa", "Code de vérification invalide.", "danger");
    },
    "/2fa",
  );
}
