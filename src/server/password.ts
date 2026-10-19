/**
 * Mots de passe : hachage et vérification.
 *
 * Les comptes repris de l'application Flask portent des hachages Werkzeug
 * (`scrypt:N:r:p$sel$hex` ou `pbkdf2:sha256:itérations$sel$hex`) ; les nouveaux
 * mots de passe sont hachés par Better Auth (scrypt, format `sel:hex`). La
 * vérification accepte les deux : personne n'a à ressaisir son mot de passe au
 * changement de socle.
 */
import { createHash, pbkdf2Sync, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { hashPassword as baHash, verifyPassword as baVerify } from "better-auth/crypto";

/** Préfixe des jetons à usage unique posés après un bind LDAP réussi (cf. server/ldap-token.ts). */
export const LDAP_TOKEN_PREFIX = "ldap-token:";

function hexEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Vérifie un hachage au format Werkzeug. false si le format est inconnu. */
export function verifyWerkzeug(hash: string, password: string): boolean {
  const parts = hash.split("$");
  if (parts.length !== 3) return false;
  const [method, salt, digest] = parts;
  try {
    if (method.startsWith("scrypt:")) {
      const [, n, r, p] = method.split(":");
      const N = Number(n);
      const derived = scryptSync(password, salt, 64, {
        N,
        r: Number(r),
        p: Number(p),
        maxmem: 132 * N * Number(r),
      });
      return hexEqual(derived.toString("hex"), digest);
    }
    if (method.startsWith("pbkdf2:")) {
      const [, algo, iters] = method.split(":");
      const iterations = Number(iters || 260000);
      const h = algo || "sha256";
      const derived = pbkdf2Sync(password, salt, iterations, createHash(h).digest().length, h);
      return hexEqual(derived.toString("hex"), digest);
    }
  } catch {
    return false;
  }
  return false;
}

/** Hachage Werkzeug (scrypt), pour les tests et la reprise : jamais pour les nouveaux comptes. */
export function hashWerkzeug(password: string): string {
  const salt = randomBytes(12).toString("base64url").slice(0, 16);
  const derived = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 132 * 32768 * 8 });
  return `scrypt:32768:8:1$${salt}$${derived.toString("hex")}`;
}

/** Hache un mot de passe au format Better Auth (scrypt). */
export async function hashPassword(password: string): Promise<string> {
  return baHash(password);
}

/** Vérifie un mot de passe contre un hachage Better Auth OU Werkzeug. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!hash) return false;
  if (hash.startsWith("scrypt:") || hash.startsWith("pbkdf2:")) {
    return verifyWerkzeug(hash, password);
  }
  try {
    return await baVerify({ hash, password });
  } catch {
    return false;
  }
}
