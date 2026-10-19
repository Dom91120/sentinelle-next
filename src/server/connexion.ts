/**
 * La connexion de Sentinelle (port de la route /login de app/auth.py) :
 *  - blocage par couple (identifiant, IP) après LOGIN_MAX_ATTEMPTS échecs ;
 *  - mot de passe local d'abord, puis bind LDAP / AD (provisionnement automatique) ;
 *  - second facteur : la session n'est ouverte qu'après le code.
 * La session elle-même est ouverte par Better Auth (`signInUsername`).
 */
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { poserMotDePasse } from "@/server/amorcage";
import { auditRecord } from "@/server/audit";
import { auth } from "@/server/auth";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { ldapAuthenticate, type LdapInfo } from "@/server/ldap";
import { issueLdapToken } from "@/server/ldap-token";
import { verifyPassword } from "@/server/password";
import { setPending2fa } from "@/server/session-2fa";

export type Connexion =
  | { ok: true; twoFactor: false }
  | { ok: true; twoFactor: true }
  | { ok: false; message: string };

/** Ne garde `next` que s'il s'agit d'un chemin interne (pas de redirection ouverte). */
export function safeNext(value: string | null | undefined): string | null {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}

async function provisionLdapUser(cfg: AppSettings, username: string, info: LdapInfo | null) {
  let role = cfg.LDAP_DEFAULT_ROLE || "viewer";
  const roleObj = await prisma.role.findUnique({ where: { name: role } });
  if (!roleObj || roleObj.isAdmin) role = "viewer";
  const domain = cfg.LDAP_DOMAIN || "ldap.local";
  let email = info?.email || `${username}@${domain}`;
  if (await prisma.user.findUnique({ where: { email } })) email = `${username}@ldap.local`;
  const u = await prisma.user.create({
    data: { username, displayUsername: username, email, name: info?.display_name || username, role, authSource: "ldap" },
  });
  // Mot de passe local inutilisable : il s'authentifiera toujours via LDAP.
  await poserMotDePasse(u.id, randomBytes(24).toString("base64url"));
  await auditRecord("creation utilisateur (LDAP)", `${username} (role ${role})`, "utilisateurs", username);
  return u;
}

async function ouvrirSession(username: string, password: string): Promise<"ok" | "2fa"> {
  const res = await auth.api.signInUsername({ body: { username, password }, headers: await headers() });
  if (res && "twoFactorRedirect" in (res as object) && (res as { twoFactorRedirect?: boolean }).twoFactorRedirect) return "2fa";
  return "ok";
}

export async function seConnecter(username: string, password: string, ip: string, next: string | null): Promise<Connexion> {
  const cfg = await getSettings();
  const now = new Date();
  const maxAttempts = cfg.LOGIN_MAX_ATTEMPTS;
  const lockoutMin = cfg.LOGIN_LOCKOUT_MINUTES;

  const throttle = await prisma.loginThrottle.findUnique({ where: { username_ip: { username, ip } } });
  if (throttle?.lockedUntil && throttle.lockedUntil > now) {
    const mins = Math.floor((throttle.lockedUntil.getTime() - now.getTime()) / 60000) + 1;
    return { ok: false, message: `Trop de tentatives. Reessayez dans ${mins} minute(s).` };
  }

  let user = await prisma.user.findUnique({ where: { username } });
  let authed = false;
  let ldapUsed = false;
  if (user) {
    const cred = await prisma.authAccount.findFirst({ where: { userId: user.id, providerId: "credential" } });
    authed = Boolean(cred?.password && (await verifyPassword(cred.password, password)));
  }
  if (!authed) {
    const info = await ldapAuthenticate(cfg, username, password);
    if (info !== null && user !== null && user.authSource !== "ldap") {
      // Homonyme d'un compte LOCAL : l'AD n'en est pas l'autorité.
      await auditRecord("refus LDAP : compte local homonyme", `identifiant: ${username}`, "securite", username);
    } else if (info !== null) {
      authed = true;
      ldapUsed = true;
      if (user === null) user = await provisionLdapUser(cfg, username, info);
    }
  }

  if (authed && user) {
    if (throttle) await prisma.loginThrottle.delete({ where: { id: throttle.id } }).catch(() => {});
    const motDePasse = ldapUsed ? issueLdapToken(user.id) : password;
    let resultat: "ok" | "2fa";
    try {
      resultat = await ouvrirSession(user.username, motDePasse);
    } catch (e) {
      if (e instanceof APIError) return { ok: false, message: e.message || "Connexion refusée." };
      throw e;
    }
    if (resultat === "2fa") {
      await setPending2fa(user.id, ldapUsed, next);
      return { ok: true, twoFactor: true };
    }
    await auditRecord(`connexion${ldapUsed ? " (LDAP)" : ""}`, "", "securite", user.username);
    return { ok: true, twoFactor: false };
  }

  // Échec : incrémente le compteur d'un cran, atomiquement sur le couple (identifiant, IP).
  const rows = await prisma.$queryRaw<{ failed_count: number }[]>`
    INSERT INTO login_throttle ("username", "ip", "failed_count", "updated_at")
    VALUES (${username}, ${ip}, 1, now())
    ON CONFLICT ("username", "ip") DO UPDATE SET
      "failed_count" = COALESCE(login_throttle."failed_count", 0) + 1,
      "updated_at" = now()
    RETURNING "failed_count"`;
  const failed = Number(rows[0]?.failed_count ?? 1);
  if (failed >= maxAttempts) {
    await prisma.loginThrottle.update({
      where: { username_ip: { username, ip } },
      data: { lockedUntil: new Date(now.getTime() + lockoutMin * 60000), failedCount: 0 },
    });
    await auditRecord("compte bloque", `identifiant: ${username}`, "securite", "anonyme");
    return { ok: false, message: `Trop de tentatives. Compte bloque ${lockoutMin} minute(s).` };
  }
  await auditRecord("echec connexion", `identifiant: ${username}`, "securite", "anonyme");
  const restantes = maxAttempts - failed;
  return { ok: false, message: `Identifiants incorrects (${restantes} tentative(s) restante(s)).` };
}
