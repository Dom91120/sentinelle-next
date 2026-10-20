import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor, username } from "better-auth/plugins";
import {
  ATTRIBUTS_COOKIE,
  alerteCookiesNonSecurises,
  cookiesSecurises,
} from "@/server/cookie-policy";
import { prisma } from "@/server/db";
import { consumeLdapToken } from "@/server/ldap-token";
import { hashPassword, LDAP_TOKEN_PREFIX, verifyPassword } from "@/server/password";

/**
 * Configuration Better Auth de Sentinelle.
 *
 * - connexion par IDENTIFIANT (plugin `username`), jamais par adresse ;
 * - mots de passe : scrypt Better Auth, ou hachages Werkzeug repris de l'application
 *   Flask (cf. server/password.ts) ;
 * - comptes Active Directory : la connexion passe par un jeton interne posé après
 *   le bind LDAP (cf. server/ldap-token.ts), Better Auth ouvrant ensuite la session ;
 * - second facteur TOTP (plugin `twoFactor`) : l'enrôlement et le verrouillage
 *   gardent les règles de Sentinelle (cf. server/two-factor.ts) ;
 * - durée de session = SESSION_LIFETIME_MINUTES (inactivité), renouvelée à l'usage.
 */

const SESSION_LIFETIME_MINUTES =
  Number.parseInt(process.env.SESSION_LIFETIME_MINUTES ?? "480", 10) || 480;

if (alerteCookiesNonSecurises()) {
  console.warn(
    "[auth] ⚠️ ALLOW_INSECURE_COOKIES=true : le cookie de session part SANS l'attribut " +
      "Secure. À réserver à un accès en HTTP sur réseau de confiance.",
  );
}

export const auth = betterAuth({
  appName: "Sentinelle",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: (request?: Request) => {
    const list = (process.env.TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (process.env.NODE_ENV === "development") {
      const origin = request?.headers.get("origin");
      if (origin && !list.includes(origin)) list.push(origin);
    }
    return list;
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // La longueur minimale de Sentinelle (PASSWORD_MIN_LENGTH, 8 par défaut) est
    // appliquée par les actions de l'application ; Better Auth ne borne ici que le plancher.
    minPasswordLength: 1,
    password: {
      hash: hashPassword,
      verify: async ({ hash, password }) => {
        if (password.startsWith(LDAP_TOKEN_PREFIX)) {
          // Jeton LDAP : il désigne l'utilisateur dont le hachage est examiné.
          const account = await prisma.authAccount.findFirst({
            where: { password: hash, providerId: "credential" },
            select: { userId: true },
          });
          return account ? consumeLdapToken(password, account.userId) : false;
        }
        return verifyPassword(hash, password);
      },
    },
  },

  session: {
    expiresIn: SESSION_LIFETIME_MINUTES * 60,
    updateAge: 60,
    freshAge: 15 * 60,
  },

  advanced: {
    useSecureCookies: cookiesSecurises(),
    defaultCookieAttributes: ATTRIBUTS_COOKIE,
  },

  // Quota par IP sur /api/auth/* (storage en base : survit aux redémarrages).
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rateLimit",
    window: 60,
    max: 200,
    customRules: {
      "/sign-in/username": { window: 60, max: 20 },
      "/two-factor/verify-totp": { window: 60, max: 20 },
    },
  },

  user: {
    modelName: "user",
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "viewer", input: false },
      authSource: { type: "string", required: false, defaultValue: "local", input: false },
    },
  },
  account: {
    modelName: "authAccount",
  },

  plugins: [
    username({
      minUsernameLength: 1,
      maxUsernameLength: 64,
      // Les identifiants Sentinelle sont libres (« d.leger », « svc_backup ») :
      // on ne les normalise ni ne les filtre au-delà de leur longueur.
      usernameNormalization: false,
      usernameValidator: () => true,
    }),
    twoFactor({
      issuer: "Sentinelle",
      skipVerificationOnEnable: false,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
