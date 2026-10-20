/** Utilisateurs et rôles (port de app/users.py). */
import { prisma } from "@/server/db";

/** `role_label` (contexte Jinja) : libellé d'un rôle. */
export function roleLabel(name: string | null | undefined): string {
  const labels: Record<string, string> = { admin: "Administrateur", editor: "Éditeur", viewer: "Lecteur" };
  if (name && name in labels) return labels[name];
  return (name ?? "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function validRoleNames(): Promise<Set<string>> {
  return new Set((await prisma.role.findMany({ select: { name: true } })).map((r) => r.name));
}

export async function adminRoleNames(): Promise<Set<string>> {
  const noms = (await prisma.role.findMany({ where: { isAdmin: true }, select: { name: true } })).map((r) => r.name);
  return new Set(noms.length ? noms : ["admin"]);
}

export async function adminUserCount(): Promise<number> {
  return prisma.user.count({ where: { role: { in: [...(await adminRoleNames())] } } });
}
