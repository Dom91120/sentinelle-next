/** Mises à jour (port de app/updates.py). */
import { champ, champOuNull, parseDate } from "@/lib/forms-util";
import { prisma } from "@/server/db";

export const STATUS_CHOICES: [string, string][] = [
  ["up_to_date", "À jour"],
  ["update_available", "Mise à jour disponible"],
  ["critical", "Critique / sécurité"],
];
export const TYPE_CHOICES: [string, string][] = [
  ["application", "Application"],
  ["system", "Matériel"],
];
export const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_CHOICES);
export const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPE_CHOICES);
const VALID_STATUS = new Set(STATUS_CHOICES.map(([v]) => v));
const VALID_TYPE = new Set(TYPE_CHOICES.map(([v]) => v));

export function cleanStatus(value: unknown): string {
  return typeof value === "string" && VALID_STATUS.has(value) ? value : "up_to_date";
}

export function cleanType(value: unknown): string {
  return typeof value === "string" && VALID_TYPE.has(value) ? value : "application";
}

export type Asset = { name: string; assetType: "application" | "system" };

/** Suggestions pour le champ « nom » : logiciels métiers (application) et équipements (système). */
export async function activeAssets(): Promise<Asset[]> {
  const [apps, systems] = await Promise.all([
    prisma.software.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return [...apps.map((s) => ({ name: s.name, assetType: "application" as const })), ...systems.map((e) => ({ name: e.name, assetType: "system" as const }))];
}

export async function formContext() {
  const [assets, equipments] = await Promise.all([activeAssets(), prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })]);
  return { assets, equipments };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

/** (software_id, equipment_id) : l'équipement choisi prime ; sinon le nom cherche sa fiche quand UNE fiche active le porte. */
export async function cible(name: string, equipmentForm: FormDataEntryValue | null): Promise<[number | null, number | null]> {
  const nom = (name ?? "").trim();
  const logiciels = nom ? await prisma.software.findMany({ where: { isActive: true, name: { equals: nom, mode: "insensitive" } }, select: { id: true } }) : [];
  const softwareId = logiciels.length === 1 ? logiciels[0].id : null;
  let equipmentId: number | null = null;
  const demande = typeof equipmentForm === "string" ? Number.parseInt(equipmentForm, 10) : Number.NaN;
  if (Number.isInteger(demande) && demande > 0) {
    const e = await prisma.equipment.findUnique({ where: { id: demande }, select: { id: true } });
    equipmentId = e ? demande : null;
  }
  if (equipmentId === null && nom) {
    const equipements = await prisma.equipment.findMany({ where: { isActive: true, name: { equals: nom, mode: "insensitive" } }, select: { id: true } });
    equipmentId = equipements.length === 1 ? equipements[0].id : null;
  }
  return [softwareId, equipmentId];
}

/** Les champs d'une mise à jour depuis le formulaire (nom validé à part). */
export async function depuisFormulaire(f: FormData, name: string) {
  const [softwareId, equipmentId] = await cible(name, f.get("equipment_id"));
  const updater = f.get("updater_type");
  return {
    name,
    systemType: cleanType(f.get("system_type")),
    currentVersion: champOuNull(f, "current_version"),
    latestVersion: champOuNull(f, "latest_version"),
    status: cleanStatus(f.get("status")),
    lastUpdate: parseDate(f.get("last_update")),
    updaterType: typeof updater === "string" ? updater : "interne",
    updatedBy: champOuNull(f, "updated_by"),
    description: typeof f.get("description") === "string" ? (f.get("description") as string) : null,
    softwareId,
    equipmentId,
  };
}

export function nomDe(f: FormData): string {
  return champ(f, "name");
}
