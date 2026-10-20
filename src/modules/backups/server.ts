/** Sauvegardes (port de app/backups.py et app/backup_ingest.py). */
import { promises as fs } from "node:fs";
import path from "node:path";
import { champ, champOuNull, idOuNull } from "@/lib/forms-util";
import { aujourdhui } from "@/lib/libelles";
import { prisma } from "@/server/db";

export const BACKUP_TYPE_LABELS: Record<string, string> = {
  full: "Complet",
  incremental: "Incrémental",
  differential: "Différentiel",
  snapshot: "Snapshot",
};
export const BACKUP_TYPE_LABELS_PLAIN: Record<string, string> = {
  full: "Complet",
  incremental: "Incremental",
  differential: "Differentiel",
  snapshot: "Snapshot",
};
export const BACKUP_TYPE_LABELS_FEM: Record<string, string> = {
  full: "Complète",
  incremental: "Incrémentale",
  differential: "Différentielle",
  snapshot: "Snapshot",
};
export const FREQ_LABELS: Record<string, string> = {
  daily: "Quotidienne",
  weekly: "Hebdomadaire",
  monthly: "Mensuelle",
};
export const FREQ_LABELS_LOWER: Record<string, string> = {
  daily: "quotidienne",
  weekly: "hebdomadaire",
  monthly: "mensuelle",
};

export async function formContext() {
  return {
    equipments: await prisma.equipment.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

async function equipmentId(f: FormData): Promise<number | null> {
  const ident = idOuNull(f, "equipment_id");
  if (!ident) return null;
  const e = await prisma.equipment.findUnique({ where: { id: ident }, select: { id: true } });
  return e ? ident : null;
}

/** Les champs d'une sauvegarde depuis le formulaire (hors service_name, validé à part). */
export async function depuisFormulaire(f: FormData) {
  return {
    backupType: champOuNull(f, "backup_type"),
    location: champOuNull(f, "location"),
    frequency: champOuNull(f, "frequency"),
    expectedTime: champOuNull(f, "expected_time"),
    description: typeof f.get("description") === "string" ? (f.get("description") as string) : null,
    equipmentId: await equipmentId(f),
  };
}

export function serviceName(f: FormData): string {
  return champ(f, "service_name");
}

// ── Ingestion des mails de sauvegarde (backup_ingest.py) ──

// Détection par MOTS ENTIERS pour éviter les faux positifs comme « Ko ».
const RE_FAIL =
  /\b(failed|failure|fail|echec|échec|erreur|error|aborted|interrompu|unsuccessful)\b/iu;
const RE_WARN = /\b(warning|avertissement|partial|partiel)\b/iu;
const RE_SUCCESS = /\b(success|succes|succès|reussi|réussi|completed|complete|terminé|termine)\b/iu;
// Tag de statut entre crochets dans l'objet (format Veeam : [Success]/[Warning]/[Failed]).
const RE_BRACKET =
  /\[\s*(success|succès|succes|ok|warning|avertissement|failed|failure|error|erreur|echec|échec)\s*\]/iu;

function mapBracket(word: string): string {
  const w = word.toLowerCase();
  if (["failed", "failure", "error", "erreur", "echec", "échec"].includes(w)) return "failed";
  if (["warning", "avertissement"].includes(w)) return "warning";
  return "ok";
}

/** Statut global déduit d'un mail (un mail = un compte-rendu de backup). */
export function detectStatus(
  subject: string | null | undefined,
  body: string | null | undefined,
): string | null {
  const s = subject ?? "";
  const text = `${s}\n${body ?? ""}`;
  const m = RE_BRACKET.exec(s);
  if (m) return mapBracket(m[1]);
  if (RE_FAIL.test(text)) return "failed";
  if (RE_WARN.test(text)) return "warning";
  if (RE_SUCCESS.test(text)) return "ok";
  return null;
}

export type IngestResult = { backup: string; status: string };

/** Enregistre le check du jour pour les backups mentionnés dans le mail. */
export async function parseAndRecord(
  subjectIn: string | null | undefined,
  bodyIn: string | null | undefined,
  source = "mail",
): Promise<IngestResult[]> {
  const today = aujourdhui();
  const subject = subjectIn ?? "";
  const body = bodyIn ?? "";
  const subjectL = subject.toLowerCase();
  const textL = `${subject}\n${body}`.toLowerCase();
  const baseStatus = detectStatus(subject, body);
  const results: IngestResult[] = [];
  for (const b of await prisma.backup.findMany({ where: { isActive: true } })) {
    const name = (b.serviceName ?? "").trim().toLowerCase();
    if (!name || !textL.includes(name)) continue;
    let status = baseStatus;
    // Nom dans l'objet, aucune erreur détectée : le compte-rendu existe, backup OK.
    if (status === null && subjectL.includes(name)) status = "ok";
    if (status === null) continue;
    const existing = await prisma.backupCheck.findUnique({
      where: { backupId_checkDate: { backupId: b.id, checkDate: today } },
    });
    if (existing) {
      await prisma.backupCheck.update({
        where: { id: existing.id },
        data: { status, checkedBy: source, comment: `Mis a jour via ${source}` },
      });
    } else {
      await prisma.backupCheck.create({
        data: {
          backupId: b.id,
          checkDate: today,
          status,
          checkedBy: source,
          comment: `Enregistre via ${source}`,
        },
      });
    }
    await prisma.backupHistory.create({
      data: {
        backupId: b.id,
        action: "mail_ingest",
        comment: `Statut ${status} deduit du mail de backup`,
        performedBy: source,
      },
    });
    results.push({ backup: b.serviceName, status });
  }
  return results;
}

// ── Connecteur « dossier » : lecture des mails déposés dans un répertoire ──

const EXT_OK = new Set([".eml", ".txt", ".html", ".htm", ".msg"]);

export function stripHtml(html: string): string {
  let text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  return text;
}

/** (sujet, corps texte) depuis un fichier .eml/.txt/.html. Les .msg (Outlook) ne sont pas supportés. */
export async function extractEmail(filePath: string): Promise<[string, string]> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".msg") throw new Error("Format .msg non supporte (exporter en .eml ou .txt)");
  if (ext === ".eml") {
    const { simpleParser } = await import("mailparser");
    const msg = await simpleParser(await fs.readFile(filePath));
    const subject = msg.subject ?? "";
    const body = msg.text ?? (msg.html ? stripHtml(msg.html) : "");
    return [subject, body];
  }
  let content = await fs.readFile(filePath, { encoding: "utf8" });
  if (ext === ".html" || ext === ".htm") content = stripHtml(content);
  return [path.basename(filePath), content];
}

export type ScanSummary = {
  error?: string;
  files: { file: string; updated?: IngestResult[]; error?: string }[];
};

/** Traite chaque fichier-mail du répertoire, enregistre les checks et déplace le fichier dans « traites ». */
export async function scanInbox(
  directory: string | null | undefined,
  source = "mail-dossier",
): Promise<ScanSummary> {
  if (!directory) return { error: `Repertoire introuvable : ${directory}`, files: [] };
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(directory);
  } catch {
    return { error: `Repertoire introuvable : ${directory}`, files: [] };
  }
  if (!stat.isDirectory()) return { error: `Repertoire introuvable : ${directory}`, files: [] };
  const processedDir = path.join(directory, "traites");
  const errorDir = path.join(directory, "erreurs");
  const files: ScanSummary["files"] = [];
  const noms = (await fs.readdir(directory)).sort();
  for (const name of noms) {
    const p = path.join(directory, name);
    try {
      if (!(await fs.stat(p)).isFile()) continue;
    } catch {
      continue;
    }
    if (!EXT_OK.has(path.extname(p).toLowerCase())) continue;
    try {
      const [subject, body] = await extractEmail(p);
      const results = await parseAndRecord(subject, body, source);
      files.push({ file: name, updated: results });
      await fs.mkdir(processedDir, { recursive: true });
      const stamp = `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}_`;
      await fs.rename(p, path.join(processedDir, stamp + name));
    } catch (e) {
      files.push({ file: name, error: e instanceof Error ? e.message : String(e) });
      await fs.mkdir(errorDir, { recursive: true });
      try {
        await fs.rename(p, path.join(errorDir, name));
      } catch {
        /* déjà déplacé ou verrouillé */
      }
    }
  }
  return { files };
}
