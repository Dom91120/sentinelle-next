/** Comptes à mot de passe (port de app/accounts.py). */
import type { Prisma } from "@/generated/prisma/client";
import { idOuNull, parseDate, parseInt_ } from "@/lib/forms-util";
import { prisma } from "@/server/db";

export const SEARCH_FIELDS = ["serviceName", "username", "url", "description"] as const;

/** Les listes des rattachements, pour le formulaire. */
export async function formContext() {
  const [software, equipments, suppliers] = await Promise.all([
    prisma.software.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return { software, equipments, suppliers };
}

/** Les rattachements choisis, vérifiés : un identifiant qui ne désigne pas une fiche active ne se pose pas. */
export async function liens(form: FormData): Promise<{ softwareId: number | null; equipmentId: number | null; supplierId: number | null }> {
  const sw = idOuNull(form, "software_id");
  const eq = idOuNull(form, "equipment_id");
  const sp = idOuNull(form, "supplier_id");
  const [s, e, p] = await Promise.all([
    sw ? prisma.software.findFirst({ where: { id: sw, isActive: true }, select: { id: true } }) : null,
    eq ? prisma.equipment.findFirst({ where: { id: eq, isActive: true }, select: { id: true } }) : null,
    sp ? prisma.supplier.findFirst({ where: { id: sp, isActive: true }, select: { id: true } }) : null,
  ]);
  return { softwareId: s?.id ?? null, equipmentId: e?.id ?? null, supplierId: p?.id ?? null };
}

function ajouterJours(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Les champs d'un compte depuis le formulaire (création et modification). */
export async function depuisFormulaire(form: FormData): Promise<Prisma.AccountUncheckedCreateInput | null> {
  const serviceName = String(form.get("service_name") ?? "").trim();
  const username = String(form.get("username") ?? "").trim();
  if (!serviceName || !username) return null;
  const lastPasswordChange = parseDate(form.get("last_password_change"));
  const rotationDays = parseInt_(form.get("rotation_days"), 90, 1) ?? 90;
  const url = form.get("url");
  const description = form.get("description");
  return {
    serviceName,
    username,
    url: typeof url === "string" ? url : null,
    ...(await liens(form)),
    description: typeof description === "string" ? description : null,
    lastPasswordChange,
    rotationDays,
    nextPasswordChange: lastPasswordChange ? ajouterJours(lastPasswordChange, rotationDays) : null,
  };
}

export { ajouterJours };
