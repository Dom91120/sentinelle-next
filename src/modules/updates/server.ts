/** Mises à jour (port de app/updates.py). */
import { champ, champOuNull, coche, parseDate } from "@/lib/forms-util";
import { aujourdhui, dateCourte } from "@/lib/libelles";
import { updateEffectiveStatus } from "@/lib/statuts";
import { auditRecord } from "@/server/audit";
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
const VALID_TYPE = new Set(TYPE_CHOICES.map(([v]) => v));
const VALID_UPDATER = new Set(UPDATER_CHOICES.map(([v]) => v));

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
  const currentVersion = champOuNull(f, "current_version");
  const latestVersion = champOuNull(f, "latest_version");
  return {
    name,
    systemType: cleanType(f.get("system_type")),
    currentVersion,
    latestVersion,
    status: statutEnregistre(coche(f, "critical"), currentVersion, latestVersion),
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

/** Ce qu'écrit « Marquer à jour » : la version actuelle rejoint la dernière disponible (ou
 * reste telle quelle si aucune n'est saisie) et, quand la mise à jour est rattachée à un
 * logiciel, sa fiche reçoit la même version. Une version vide n'écrase rien. */
export function marquage(update: {
  currentVersion: string | null;
  latestVersion: string | null;
  softwareId: number | null;
}): { currentVersion: string | null; logiciel: { id: number; version: string } | null } {
  const currentVersion = update.latestVersion ? update.latestVersion : update.currentVersion;
  const logiciel =
    update.softwareId && currentVersion ? { id: update.softwareId, version: currentVersion } : null;
  return { currentVersion, logiciel };
}

/** Le statut enregistré depuis le formulaire : la case « Critique / sécurité » vaut `critical` ;
 * sinon il se déduit des versions, comme à l'affichage, pour que la base dise la même chose que
 * l'écran (« disponible » quand une dernière version différente est connue, « à jour » sinon). */
export function statutEnregistre(
  critique: boolean,
  currentVersion: string | null,
  latestVersion: string | null,
): string {
  if (critique) return "critical";
  return updateEffectiveStatus({ status: "up_to_date", currentVersion, latestVersion });
}

/** Données d'un enregistrement sans marquage : « Date MAJ » laissée vide conserve la date mémorisée. */
export function donneesSimples<T extends { lastUpdate: Date | null }>(
  saisie: T,
): Omit<T, "lastUpdate"> | T {
  if (saisie.lastUpdate) return saisie;
  const { lastUpdate: _vide, ...reste } = saisie;
  return reste;
}

/** La ligne d'historique d'un marquage : « Mis à jour de la version X en version Y le date », la
 * version de départ (celle qu'affichait « Version actuelle ») et la date seulement si connues. */
export function commentaireMarquage(
  depuis: string | null,
  vers: string | null,
  date: Date | null,
): string {
  const avant = (depuis ?? "").trim();
  const apres = (vers ?? "").trim();
  let texte = "Mis à jour";
  if (avant !== "" && avant !== apres) texte += ` de la version ${avant}`;
  texte += ` en version ${apres || "?"}`;
  if (date) texte += ` le ${dateCourte(date)}`;
  return texte;
}

/** Enregistre la fiche telle que saisie. Si « Mise à jour effectuée » est actif, la marque dans le
 * même mouvement : la version actuelle rejoint la dernière disponible, le statut passe à « À jour »,
 * « Date MAJ » fait foi (aujourd'hui si vide), une ligne d'historique est écrite et la fiche
 * Logiciel liée reçoit la version. Tout ou rien. */
export async function enregistrerSaisie(
  id: number,
  saisie: Awaited<ReturnType<typeof depuisFormulaire>>,
  effectuee: boolean,
  username: string,
): Promise<void> {
  if (!effectuee) {
    await prisma.systemUpdate.update({ where: { id }, data: donneesSimples(saisie) });
    return;
  }
  const { currentVersion, logiciel } = marquage(saisie);
  const lastUpdate = saisie.lastUpdate ?? aujourdhui();
  const comment = commentaireMarquage(saisie.currentVersion, currentVersion, saisie.lastUpdate);
  await prisma.$transaction([
    prisma.systemUpdate.update({
      where: { id },
      data: { ...saisie, currentVersion, status: "up_to_date", lastUpdate },
    }),
    prisma.updateHistory.create({
      data: { updateId: id, action: "updated", comment, performedBy: username },
    }),
    ...(logiciel
      ? [
          prisma.software.update({
            where: { id: logiciel.id },
            data: { version: logiciel.version },
          }),
        ]
      : []),
  ]);
  if (logiciel) {
    const s = await prisma.software.findUnique({
      where: { id: logiciel.id },
      select: { name: true },
    });
    if (s) await auditRecord("modification logiciel", s.name, "inventory", username);
  }
}
