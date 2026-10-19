/**
 * Second facteur TOTP, avec les règles de Sentinelle (app/auth.py) :
 *  - enrôlement depuis le profil : un secret est proposé (QR code + clé), puis
 *    confirmé par un premier code ;
 *  - à la connexion, le code est demandé APRÈS le mot de passe ; les essais sont
 *    comptés EN BASE (totp_failed_count) et le compte se verrouille
 *    LOGIN_LOCKOUT_MINUTES après LOGIN_MAX_ATTEMPTS échecs.
 *
 * Le stockage et la vérification des codes sont ceux du plugin `twoFactor` de
 * Better Auth (table two_factor, secret chiffré) : on écrit la ligne comme le
 * plugin l'écrirait, et c'est lui qui vérifie (`/two-factor/verify-totp`).
 */
import { generateRandomString, symmetricEncrypt } from "better-auth/crypto";
import { createOTP } from "@better-auth/utils/otp";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

export type Enrolement = { secret: string; uri: string; cleManuelle: string };

/** Prépare l'enrôlement : secret chiffré en base (non vérifié), URI et clé manuelle pour l'écran. */
export async function initTwoFactor(userId: string, username: string): Promise<Enrolement> {
  const ctx = await auth.$context;
  const secret = generateRandomString(32);
  const encrypted = await symmetricEncrypt({ key: ctx.secretConfig, data: secret });
  const backup = await symmetricEncrypt({ key: ctx.secretConfig, data: JSON.stringify([]) });
  const existing = await prisma.twoFactor.findFirst({ where: { userId } });
  const data = { secret: encrypted, backupCodes: backup, verified: false, failedVerificationCount: 0, lockedUntil: null };
  if (existing) await prisma.twoFactor.update({ where: { id: existing.id }, data });
  else await prisma.twoFactor.create({ data: { ...data, userId } });
  const uri = createOTP(secret, { digits: 6, period: 30 }).url("Sentinelle", username);
  const cleManuelle = new URL(uri).searchParams.get("secret") ?? "";
  return { secret, uri, cleManuelle };
}

/** L'enrôlement en attente de confirmation (secret posé mais non vérifié). */
export async function pendingEnrolement(userId: string, username: string): Promise<Enrolement | null> {
  const ctx = await auth.$context;
  const row = await prisma.twoFactor.findFirst({ where: { userId, verified: false } });
  if (!row) return null;
  const { symmetricDecrypt } = await import("better-auth/crypto");
  const secret = await symmetricDecrypt({ key: ctx.secretConfig, data: row.secret });
  const uri = createOTP(secret, { digits: 6, period: 30 }).url("Sentinelle", username);
  return { secret, uri, cleManuelle: new URL(uri).searchParams.get("secret") ?? "" };
}

/** Abandonne un enrôlement non confirmé. */
export async function cancelEnrolement(userId: string): Promise<void> {
  await prisma.twoFactor.deleteMany({ where: { userId, verified: false } });
}

/** Retire le second facteur d'un utilisateur (réinitialisation par un administrateur). */
export async function resetTwoFactor(userId: string): Promise<void> {
  await prisma.twoFactor.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, totpFailedCount: 0, totpLockedUntil: null },
  });
}

/** Nettoie un code saisi : chiffres seuls. */
export function normaliserCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
}
