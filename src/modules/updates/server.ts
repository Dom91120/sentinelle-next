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
/** Qui a réalisé la mise à jour : une personne (annuaire), un fournisseur (inventaire) ou autre (saisie libre). */
export const UPDATER_CHOICES: [string, string][] = [
  ["interne", "Interne"],
  ["prestataire", "Prestataire"],
  ["autre", "Autre"],
];
export const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_CHOICES);
export const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPE_CHOICES);
export const UPDATER_LABELS: Record<string, string> = Object.fromEntries(UPDATER_CHOICES);
const VALID_STATUS = new Set(STATUS_CHOICES.map(([v]) => v));
const VALID_TYPE = new Set(TYPE_CHOICES.map(([v]) => v));
const VALID_UPDATER = new Set(UPDATER_CHOICES.map(([v]) => v));

export function cleanStatus(value: unknown): string {
  return typeof value === "string" && VALID_STATUS.has(value) ? value : "up_to_date";
}

export function cleanType(value: unknown): string {
  return typeof value === "string" && VALID_TYPE.has(value) ? value : "application";
}

export function cleanUpdater(value: unknown): string {
  return typeof value === "string" && VALID_UPDATER.has(value) ? value : "interne";
}

export type AssetType = "application" | "system";
export type Asset = { id: number; name: string; assetType: AssetType };

/** La valeur du sélecteur « Matériel / Application » pour une fiche. */
export function cibleValeur(assetType: AssetType, id: number): string {
  return `${assetType}:${id}`;
}

/** Les fiches proposées par le sélecteur : logiciels métiers (application) et équipements (système). */
export async function activeAssets(): Promise<Asset[]> {
  const [apps, systems] = await Promise.all([
    prisma.software.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.equipment.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return [
    ...apps.map((s) => ({ id: s.id, name: s.name, assetType: "application" as const })),
    ...systems.map((e) => ({ id: e.id, name: e.name, assetType: "system" as const })),
  ];
}

export type Prestataire = { id: number; name: string };

export async function formContext() {
  const [assets, prestataires] = await Promise.all([
    activeAssets(),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { assets, prestataires };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

/**
 * (software_id, equipment_id) d'après le sélecteur « Matériel / Application » (`application:<id>`
 * ou `system:<id>`). Le nom de la mise à jour n'est qu'un libellé : il ne relie rien. Une valeur
 * absente, mal formée ou qui ne désigne aucune fiche ne pose aucun lien.
 */
export async function cible(
  cibleForm: FormDataEntryValue | null,
): Promise<[number | null, number | null]> {
  const m = typeof cibleForm === "string" ? /^(application|system):(\d+)$/.exec(cibleForm) : null;
  if (!m) return [null, null];
  const id = Number.parseInt(m[2], 10);
  if (!Number.isInteger(id) || id <= 0) return [null, null];
  if (m[1] === "application") {
    const s = await prisma.software.findUnique({ where: { id }, select: { id: true } });
    return [s ? id : null, null];
  }
  const e = await prisma.equipment.findUnique({ where: { id }, select: { id: true } });
  return [null, e ? id : null];
}

/** Les champs d'une mise à jour depuis le formulaire (nom validé à part). */
export async function depuisFormulaire(f: FormData, name: string) {
  const [softwareId, equipmentId] = await cible(f.get("target"));
  return {
    name,
    systemType: cleanType(f.get("system_type")),
    currentVersion: champOuNull(f, "current_version"),
    latestVersion: champOuNull(f, "latest_version"),
    status: cleanStatus(f.get("status")),
    lastUpdate: parseDate(f.get("last_update")),
    updaterType: cleanUpdater(f.get("updater_type")),
    updatedBy: champOuNull(f, "updated_by"),
    description: typeof f.get("description") === "string" ? (f.get("description") as string) : null,
    softwareId,
    equipmentId,
  };
}

export function nomDe(f: FormData): string {
  return champ(f, "name");
}
