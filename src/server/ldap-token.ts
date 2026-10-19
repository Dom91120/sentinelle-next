/**
 * Jetons à usage unique posés après un bind LDAP réussi.
 *
 * L'ouverture de session reste l'affaire de Better Auth (`signInUsername`), qui
 * exige un mot de passe. Un compte Active Directory n'en a pas de local : la
 * connexion LDAP produit donc un jeton de quelques secondes, mémorisé dans le
 * processus, que `verifyPassword` (server/auth.ts) reconnaît et consomme. Le
 * jeton ne quitte jamais le serveur : l'appel `auth.api` est interne.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { LDAP_TOKEN_PREFIX } from "@/server/password";

const TTL_MS = 30_000;
const jetons = new Map<string, { userId: string; expires: number }>();

function purge(): void {
  const now = Date.now();
  for (const [k, v] of jetons) if (v.expires < now) jetons.delete(k);
}

/** Émet un jeton pour cet utilisateur ; renvoie la valeur à passer comme « mot de passe ». */
export function issueLdapToken(userId: string): string {
  purge();
  const token = randomBytes(24).toString("base64url");
  jetons.set(token, { userId, expires: Date.now() + TTL_MS });
  return LDAP_TOKEN_PREFIX + token;
}

/** Consomme le jeton s'il est valide pour cet utilisateur (une seule fois). */
export function consumeLdapToken(value: string, userId: string): boolean {
  if (!value.startsWith(LDAP_TOKEN_PREFIX)) return false;
  purge();
  const token = value.slice(LDAP_TOKEN_PREFIX.length);
  const entry = jetons.get(token);
  if (!entry) return false;
  jetons.delete(token);
  const a = Buffer.from(entry.userId);
  const b = Buffer.from(userId);
  return a.length === b.length && timingSafeEqual(a, b) && entry.expires >= Date.now();
}
