/**
 * L'état « 2FA en attente » entre le mot de passe et le code (port de
 * session['pending_2fa_*'] de Flask) : un cookie signé, de courte durée, qui dit
 * QUI attend, si la connexion venait de l'AD et où aller ensuite. Better Auth
 * pose de son côté son propre cookie de second facteur ; celui-ci ne sert qu'aux
 * règles de Sentinelle (compteur d'essais, journal, redirection).
 */
import { cookies } from "next/headers";
import { hmacSign, timingSafeEqualStr } from "@/server/crypto";

const COOKIE = "sentinelle_2fa";
const TTL_S = 10 * 60;

export type Pending2fa = { uid: string; ldap: boolean; next: string | null; exp: number };

function signer(payload: string): string {
  return hmacSign("pending-2fa", payload);
}

export async function setPending2fa(
  uid: string,
  ldap: boolean,
  next: string | null,
): Promise<void> {
  const data: Pending2fa = { uid, ldap, next, exp: Date.now() + TTL_S * 1000 };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${signer(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_S,
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIES !== "true",
  });
}

export async function pending2fa(): Promise<Pending2fa | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !timingSafeEqualStr(sig, signer(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Pending2fa;
    if (!data.uid || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function clearPending2fa(): Promise<void> {
  const jar = await cookies();
  if (jar.get(COOKIE)) jar.delete(COOKIE);
}
