/**
 * Session et droits (port de flask_login + app/decorators.py + User.perm_level).
 *
 * `getSession` est mémoïsée par requête (React.cache) ; `getCurrentUser` y ajoute
 * la fiche utilisateur complète, son rôle et la configuration vivante, pour
 * répondre à `canView` / `canEdit` / `canDelete` / `isAdmin` comme le faisait le
 * modèle `User` de Flask.
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Role as RoleRow, User as UserRow } from "@/generated/prisma/client";
import { PERMISSION_CATEGORIES, type PermissionCategory } from "@/lib/constantes";
import { auth } from "@/server/auth";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { categoryEnabledIn } from "@/server/features";
import { flash } from "@/server/flash";

const TOUCH_THROTTLE_MS = 60_000;

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

/** Lit la session Better Auth et applique le délai d'inactivité (SESSION_LIFETIME_MINUTES). */
async function readSession(): Promise<SessionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const lifetimeMs =
    (Number.parseInt(process.env.SESSION_LIFETIME_MINUTES ?? "480", 10) || 480) * 60_000;
  const lastSeen = session.session.updatedAt.getTime();
  if (Date.now() - lastSeen > lifetimeMs) {
    await prisma.session.deleteMany({ where: { id: session.session.id } });
    return null;
  }
  if (Date.now() - lastSeen >= TOUCH_THROTTLE_MS) {
    try {
      await prisma.session.update({
        where: { id: session.session.id },
        data: { updatedAt: new Date() },
      });
    } catch (e) {
      console.error("[guards] horodatage d'activité échoué :", e);
    }
  }
  return session;
}

export const getSession = cache(async () => readSession());

/** L'utilisateur connecté, avec ses droits. Équivalent de `current_user`. */
export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  roleObj: RoleRow | null;
  authSource: string;
  isLdap: boolean;
  hasTwoFactor: boolean;
  isAdmin: boolean;
  createdAt: Date;
  icsToken: string | null;
  dashboardPrefs: string | null;
  listPrefs: string | null;
  totpFailedCount: number;
  totpLockedUntil: Date | null;
  settings: AppSettings;
  permLevel: (category: string) => number;
  canView: (category?: string | null) => boolean;
  canEdit: (category?: string | null) => boolean;
  canDelete: (category: string) => boolean;
};

const ROLE_FALLBACK_ADMIN = "admin";

export function buildCurrentUser(
  row: UserRow,
  roleObj: RoleRow | null,
  settings: AppSettings,
): CurrentUser {
  const isAdmin = roleObj ? Boolean(roleObj.isAdmin) : row.role === ROLE_FALLBACK_ADMIN;
  const permLevel = (category: string): number => {
    if (!categoryEnabledIn(settings, category)) return 0;
    if (roleObj) {
      if (roleObj.isAdmin) return 3;
      const perms = (roleObj.permissions as Record<string, number> | null) ?? {};
      return Number(perms[category] ?? 0) || 0;
    }
    if (row.role === "admin") return 3;
    if (row.role === "editor") return category === "alerts" ? 1 : 3;
    return 1;
  };
  const canEdit = (category?: string | null): boolean => {
    if (category === undefined || category === null) {
      return isAdmin || PERMISSION_CATEGORIES.some((c) => permLevel(c) >= 2);
    }
    return permLevel(category) >= 2;
  };
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    roleObj,
    authSource: row.authSource,
    isLdap: row.authSource === "ldap",
    hasTwoFactor: Boolean(row.twoFactorEnabled),
    isAdmin,
    createdAt: row.createdAt,
    icsToken: row.icsToken,
    dashboardPrefs: row.dashboardPrefs,
    listPrefs: row.listPrefs,
    totpFailedCount: row.totpFailedCount,
    totpLockedUntil: row.totpLockedUntil,
    settings,
    permLevel,
    canView: (category) =>
      category === undefined || category === null ? true : permLevel(category) >= 1,
    canEdit,
    canDelete: (category) => permLevel(category) >= 3,
  };
}

/** Charge un utilisateur et son rôle en CurrentUser (hors requête : tâches, tests). */
export async function loadUser(userId: string): Promise<CurrentUser | null> {
  const [row, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getSettings(),
  ]);
  if (!row) return null;
  const roleObj = row.role ? await prisma.role.findUnique({ where: { name: row.role } }) : null;
  return buildCurrentUser(row, roleObj, settings);
}

/** `current_user` : null si personne n'est connecté. Mémoïsé par requête. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  return loadUser(session.user.id);
});

/** Chemin courant, pour le paramètre `next` de la page de connexion. */
async function cheminCourant(): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") ?? h.get("next-url") ?? "/";
}

/** `@login_required` : redirige vers /login sinon. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = await cheminCourant();
    redirect(next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

async function deny(
  message = "Vous n'avez pas les droits pour effectuer cette action.",
): Promise<never> {
  await flash(message, "danger");
  redirect("/");
}

/** `view_guard(category)` : bloque la lecture d'une catégorie non autorisée. */
export async function requireView(category: PermissionCategory | string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.canView(category)) await deny("Acces non autorise a cette section.");
  return user;
}

/** `@require_edit` : exige le droit d'écriture sur la catégorie (ou n'importe laquelle si absente). */
export async function requireEdit(
  category?: PermissionCategory | string | null,
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.canEdit(category ?? null)) await deny();
  return user;
}

/** `@require_delete` : exige le droit de suppression sur la catégorie. */
export async function requireDelete(category: PermissionCategory | string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.canDelete(category)) await deny();
  return user;
}

/** `@require_admin` : réservé aux administrateurs. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) await deny("Acces reserve aux administrateurs.");
  return user;
}

/** Variante pour les routes API (route.ts) : lève au lieu de rediriger. */
export class ApiAuthError extends Error {
  constructor(
    readonly statut: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

export async function requireUserApi(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiAuthError(401, "Authentification requise.");
  return user;
}

export async function requireViewApi(category: string): Promise<CurrentUser> {
  const user = await requireUserApi();
  if (!user.canView(category)) throw new ApiAuthError(403, "Droits insuffisants.");
  return user;
}

export async function requireEditApi(category?: string | null): Promise<CurrentUser> {
  const user = await requireUserApi();
  if (!user.canEdit(category ?? null)) throw new ApiAuthError(403, "Droits insuffisants.");
  return user;
}

export async function requireAdminApi(): Promise<CurrentUser> {
  const user = await requireUserApi();
  if (!user.isAdmin) throw new ApiAuthError(403, "Acces reserve aux administrateurs.");
  return user;
}

/** Enveloppe d'une route API : convertit un refus en réponse HTTP. */
export async function reponseApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return Response.json({ error: e.message }, { status: e.statut });
    }
    throw e;
  }
}

/** Un identifiant de fiche depuis un paramètre de route ; 404 sinon. */
export function idDeRoute(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return n;
}
