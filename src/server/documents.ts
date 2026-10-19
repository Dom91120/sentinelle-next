/**
 * Pièces jointes (port de app/documents.py) : règles de dépôt, aperçu, chemins de retour.
 */
import type { Document, Referential } from "@/generated/prisma/client";
import { DOCUMENT_PARENTS, type PermissionCategory } from "@/lib/constantes";
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";

export const DEFAULT_MAX_MB = 10;

export const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "odt", "rtf", "txt", "md",
  "xls", "xlsx", "ods", "csv",
  "ppt", "pptx", "odp",
  "png", "jpg", "jpeg", "gif", "webp", "svg",
  "zip", "7z", "eml", "msg",
]);

export const INLINE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export function documentsEnabled(cfg: AppSettings): boolean {
  return Boolean(cfg.DOCUMENTS_ENABLED ?? true);
}

export function inlineViewEnabled(cfg: AppSettings): boolean {
  return documentsEnabled(cfg) && Boolean(cfg.DOCUMENT_INLINE_VIEW ?? true);
}

export function extension(nom: string): string {
  return nom.includes(".") ? nom.split(".").pop()?.toLowerCase() ?? "" : "";
}

export function viewable(cfg: AppSettings, doc: { filename: string }): boolean {
  return inlineViewEnabled(cfg) && extension(doc.filename || "") in INLINE_TYPES;
}

export function maxBytes(cfg: AppSettings): number {
  const mo = Number.parseInt(String(cfg.DOCUMENT_MAX_MB || DEFAULT_MAX_MB), 10);
  return Math.max(1, Number.isFinite(mo) ? mo : DEFAULT_MAX_MB) * 1024 * 1024;
}

export type DocumentAvecCategorie = Document & { category: Referential | null };

/** Les pièces d'une fiche, la plus récente en tête. */
export async function forParent(kind: string, parentId: number): Promise<DocumentAvecCategorie[]> {
  const parent = DOCUMENT_PARENTS[kind];
  if (!parent) return [];
  return prisma.document.findMany({
    where: { [parent[0]]: parentId },
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });
}

/** Le type de parent auquel une pièce est accrochée. */
export function parentKind(doc: Document): string | null {
  for (const [kind, [col]] of Object.entries(DOCUMENT_PARENTS)) {
    if ((doc as unknown as Record<string, unknown>)[col]) return kind;
  }
  return null;
}

export function parentId(doc: Document): number | null {
  const kind = parentKind(doc);
  if (!kind) return null;
  return (doc as unknown as Record<string, number | null>)[DOCUMENT_PARENTS[kind][0]];
}

/** La catégorie de droits à exiger pour lire ou retirer une pièce. */
export function permissionCategoryOf(doc: Document): PermissionCategory {
  const kind = parentKind(doc);
  return kind ? DOCUMENT_PARENTS[kind][1] : "contracts";
}

export function hasFile(doc: { size: number | null }): boolean {
  return Boolean(doc.size);
}

const ECRANS: Record<string, string> = {
  software: "/inventory/logiciels",
  supplier: "/suppliers",
  contract: "/contracts",
  certificate: "/certificates",
  equipment: "/inventory",
};

/** Là d'où l'on vient. Un parent disparu ramène au tableau de bord. */
export async function retour(kind: string | null, parentIdValue: number | null): Promise<string> {
  if (kind === "quote") {
    const devis = parentIdValue ? await prisma.quote.findUnique({ where: { id: parentIdValue }, include: { consultation: true } }) : null;
    return devis ? `/inventory/logiciels/${devis.consultation.softwareId}` : "/";
  }
  const base = kind ? ECRANS[kind] : undefined;
  return base && parentIdValue ? `${base}/${parentIdValue}` : "/";
}

/** Le nom qu'on donne à une pièce : libre, mais jamais un chemin ni un caractère de contrôle. */
export function nomAffiche(valeur: unknown): string {
  let nom = String(valeur ?? "").trim();
  nom = [...nom].filter((ch) => ch !== "/" && ch !== "\\" && ch.charCodeAt(0) >= 32).join("");
  nom = nom.replace(/^[ .]+|[ .]+$/g, "");
  return nom.slice(0, 256);
}

/** `secure_filename` de Werkzeug, en version simplifiée. */
export function secureFilename(nom: string): string {
  const normalise = nom.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const sans = normalise.replace(/[/\\]/g, " ").replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/^[._]+|[._]+$/g, "");
  return sans;
}

export type FichierLu = { nom: string; mime: string; octets: Buffer };

/** (nom, mime, octets) du fichier envoyé, ou le message qui explique le refus. */
export async function lireFichier(cfg: AppSettings, fichier: FormDataEntryValue | null): Promise<FichierLu | string> {
  if (!fichier || typeof fichier === "string" || !(fichier.name || "").trim()) return "Choisissez un fichier.";
  const nom = secureFilename(fichier.name) || "piece-jointe";
  const ext = extension(nom);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `Type de fichier non accepté (.${ext || "?"}). Acceptés : ${[...ALLOWED_EXTENSIONS].sort().join(", ")}.`;
  }
  const octets = Buffer.from(await fichier.arrayBuffer());
  if (!octets.length) return "Le fichier est vide.";
  const max = maxBytes(cfg);
  if (octets.length > max) {
    return `Fichier trop volumineux (${Math.floor(octets.length / (1024 * 1024))} Mo) : maximum ${Math.floor(max / (1024 * 1024))} Mo.`;
  }
  return { nom, mime: (fichier.type || "").slice(0, 128), octets };
}

/** Les catégories de pièces (Référentiels). */
export async function docCategories(): Promise<Referential[]> {
  return prisma.referential.findMany({ where: { kind: "doc_category", isActive: true }, orderBy: [{ position: "asc" }, { label: "asc" }] });
}
