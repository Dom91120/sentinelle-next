/**
 * La base de test, vidée et réamorcée avant chaque test (la base SQLite mémoire de
 * conftest.py, mais sur PostgreSQL) ; les fabriques des fiches des tests.
 */
import "./env";
import { amorcer } from "@/server/amorcage";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/password";
import { ADMIN_PASSWORD } from "./env";

/** Vide toutes les tables (sauf l'historique des migrations) et réamorce rôles, référentiels, admin, configuration. */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
    );
  }
  await amorcer({ annoncer: false });
}

export { prisma };

/** Jour J+n, à minuit UTC (la `_day(offset)` des tests Flask). */
export function jour(offset = 0): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() + offset * 86_400_000);
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Un utilisateur local avec un rôle (et ses permissions), connectable par `ClientTest.login`. */
export async function creerUtilisateur(
  username: string,
  password: string,
  role: string,
  permissions?: Record<string, number>,
  email?: string,
) {
  if (permissions) {
    await prisma.role.upsert({
      where: { name: role },
      update: { permissions },
      create: { name: role, permissions, isAdmin: false },
    });
  }
  const u = await prisma.user.create({
    data: {
      username,
      displayUsername: username,
      email: email ?? `${username}@test.fr`,
      name: username,
      role,
      authSource: "local",
    },
  });
  await prisma.authAccount.create({
    data: {
      accountId: u.id,
      providerId: "credential",
      userId: u.id,
      password: await hashPassword(password),
    },
  });
  return u;
}

/** L'administrateur amorcé, avec son mot de passe de test. */
export async function admin() {
  const u = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!u) throw new Error("admin absent : resetDb() n'a pas été appelé");
  return u;
}

export { ADMIN_PASSWORD };

/** Écrit des réglages (comme `app.config[...] = ...`), chiffrés s'il le faut. */
export async function regler(
  valeurs: Record<string, string | boolean | number | string[]>,
): Promise<void> {
  const { saveSettings } = await import("@/server/config-store");
  const plat: Record<string, string> = {};
  for (const [k, v] of Object.entries(valeurs)) {
    if (typeof v === "boolean") plat[k] = v ? "true" : "false";
    else if (Array.isArray(v)) plat[k] = v.join(",");
    else plat[k] = String(v);
  }
  await saveSettings(plat);
}

/** Lit un réglage vivant (comme `app.config[...]`). */
export async function reglage<T = unknown>(cle: string): Promise<T> {
  const { getSettings } = await import("@/server/config-store");
  return (await getSettings())[cle] as T;
}
