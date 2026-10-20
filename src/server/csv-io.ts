/**
 * Export / import / modèle CSV pour les principales entités (port de app/csv_io.py).
 *
 * CSV en UTF-8 avec BOM et séparateur ';' (compatible Excel FR). L'import détecte le
 * séparateur (';' ou ',') et accepte les dates JJ/MM/AAAA ou AAAA-MM-JJ.
 */
import { CERT_SUPPORT_LABELS, CERT_USAGE_LABELS } from "@/lib/constantes";
import { prisma } from "@/server/db";

type Kind = "str" | "date" | "bool" | "int" | "float" | "equipment_ref" | `ref:${string}`;
/** Une colonne : son nom CSV, son type, et le champ Prisma qu'elle lit (relation pour les références). */
type Colonne = { csv: string; kind: Kind; champ: string };

type Ligne = Record<string, unknown>;

export type Spec = {
  label: string;
  listUrl: string;
  columns: Colonne[];
  example: Record<string, string>;
  charger: () => Promise<Ligne[]>;
  creer: (data: Ligne) => Promise<unknown>;
  post?: (data: Ligne) => void;
};

const c = (
  csv: string,
  kind: Kind,
  champ = csv.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase()),
): Colonne => ({ csv, kind, champ });

const JOUR = 86_400_000;
const plusJours = (d: Date, n: number) => new Date(d.getTime() + n * JOUR);

function accountPost(o: Ligne): void {
  if (o.lastPasswordChange instanceof Date && typeof o.rotationDays === "number")
    o.nextPasswordChange = plusJours(o.lastPasswordChange, o.rotationDays);
}
function testPost(o: Ligne): void {
  if (!o.nextDue && o.lastPerformed instanceof Date && typeof o.frequencyDays === "number")
    o.nextDue = plusJours(o.lastPerformed, o.frequencyDays);
}
function reviewPost(o: Ligne): void {
  if (!o.nextReview && o.lastReview instanceof Date && typeof o.frequencyDays === "number")
    o.nextReview = plusJours(o.lastReview, o.frequencyDays);
}

const actifs = { where: { isActive: true } } as const;

export const SPECS: Record<string, Spec> = {
  accounts: {
    label: "comptes",
    listUrl: "/accounts",
    columns: [
      c("service_name", "str"),
      c("username", "str"),
      c("url", "str"),
      c("description", "str"),
      c("last_password_change", "date"),
      c("rotation_days", "int"),
    ],
    example: {
      service_name: "Active Directory",
      username: "admin",
      url: "https://ad.local",
      description: "Compte admin",
      last_password_change: "2026-01-15",
      rotation_days: "90",
    },
    charger: () => prisma.account.findMany(actifs),
    creer: (data) => prisma.account.create({ data: data as never }),
    post: accountPost,
  },
  certificates: {
    label: "certificats",
    listUrl: "/certificates",
    // Les deux natures partagent le même fichier : une colonne `kind` les distingue. Le code
    // de révocation n'y figure PAS : un secret n'a pas à voyager dans un tableur.
    // `service_name` reste EN TÊTE : c'est la colonne-clé, celle dont le vide fait sauter la ligne.
    columns: [
      c("service_name", "str"),
      c("kind", "str"),
      c("domain", "str"),
      c("issuer", "str"),
      c("issued_at", "date"),
      c("expiry_date", "date"),
      c("auto_renew", "bool"),
      c("description", "str"),
      c("equipment", "equipment_ref", "equipment"),
      c("civility", "str"),
      c("first_name", "str"),
      c("holder", "str"),
      c("holder_role", "str"),
      c("holder_email", "str"),
      c("cert_usage", "ref:cert_usage", "certUsage"),
      c("support", "ref:cert_support", "support"),
      c("level", "str"),
      c("serial_number", "str"),
      c("duration_years", "int"),
      c("amount_ttc", "float"),
      c("budget_code", "str"),
      c("validity", "str"),
    ],
    example: {
      service_name: "Site web",
      kind: "tls",
      domain: "www.collectivite.fr",
      issuer: "Let's Encrypt",
      issued_at: "2026-03-01",
      expiry_date: "2026-06-01",
      auto_renew: "oui",
      description: "",
      equipment: "SRV-WEB-01",
    },
    charger: () =>
      prisma.certificate.findMany({
        ...actifs,
        include: { equipment: true, certUsage: true, support: true },
      }),
    creer: (data) => prisma.certificate.create({ data: data as never }),
  },
  domains: {
    label: "domaines",
    listUrl: "/domains",
    columns: [
      c("name", "str"),
      c("registrar", "str"),
      c("expiry_date", "date"),
      c("auto_renew", "bool"),
      c("description", "str"),
    ],
    example: {
      name: "collectivite.fr",
      registrar: "OVH",
      expiry_date: "2035-06-29",
      auto_renew: "oui",
      description: "",
    },
    charger: () => prisma.domain.findMany(actifs),
    creer: (data) => prisma.domain.create({ data: data as never }),
  },
  backups: {
    label: "backups",
    listUrl: "/backups",
    columns: [
      c("service_name", "str"),
      c("backup_type", "str"),
      c("location", "str"),
      c("frequency", "str"),
      c("expected_time", "str"),
      c("description", "str"),
      c("equipment", "equipment_ref", "equipment"),
    ],
    example: {
      service_name: "SQL Server Prod",
      backup_type: "full",
      location: "\\\\nas\\backups\\sql",
      frequency: "daily",
      expected_time: "02:00",
      description: "",
      equipment: "SRV-SQL-01",
    },
    charger: () => prisma.backup.findMany({ ...actifs, include: { equipment: true } }),
    creer: (data) => prisma.backup.create({ data: data as never }),
  },
  tests: {
    label: "tests",
    listUrl: "/tests",
    columns: [
      c("name", "str"),
      c("test_type", "str"),
      c("description", "str"),
      c("last_performed", "date"),
      c("next_due", "date"),
      c("frequency_days", "int"),
    ],
    example: {
      name: "Test de restauration",
      test_type: "restoration",
      description: "",
      last_performed: "2026-01-10",
      next_due: "",
      frequency_days: "90",
    },
    charger: () => prisma.testTask.findMany(actifs),
    creer: (data) => prisma.testTask.create({ data: data as never }),
    post: testPost,
  },
  reviews: {
    label: "revues de droits",
    listUrl: "/reviews",
    columns: [
      c("application", "str"),
      c("responsible", "str"),
      c("scope", "str"),
      c("frequency_days", "int"),
      c("last_review", "date"),
      c("next_review", "date"),
    ],
    example: {
      application: "SIRH",
      responsible: "DRH",
      scope: "Comptes RH",
      frequency_days: "365",
      last_review: "2026-01-15",
      next_review: "",
    },
    charger: () => prisma.accessReview.findMany(actifs),
    creer: (data) => prisma.accessReview.create({ data: data as never }),
    post: reviewPost,
  },
  updates: {
    label: "mises a jour",
    listUrl: "/updates",
    columns: [
      c("name", "str"),
      c("system_type", "str"),
      c("current_version", "str"),
      c("latest_version", "str"),
      c("status", "str"),
      c("last_update", "date"),
      c("updater_type", "str"),
      c("updated_by", "str"),
      c("description", "str"),
      c("equipment", "equipment_ref", "equipment"),
    ],
    example: {
      name: "Windows Server 2022",
      system_type: "system",
      current_version: "21H2",
      latest_version: "21H2",
      status: "up_to_date",
      last_update: "2026-05-01",
      updater_type: "interne",
      updated_by: "Jean Dupont",
      description: "",
      equipment: "SRV-AD-01",
    },
    charger: () => prisma.systemUpdate.findMany({ ...actifs, include: { equipment: true } }),
    creer: (data) => prisma.systemUpdate.create({ data: data as never }),
  },
};

export function isValid(key: string): key is keyof typeof SPECS {
  return Object.hasOwn(SPECS, key);
}

// ── Valeurs ──

function parseDateCsv(value: string): Date | null {
  const v = value.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return jourUtc(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(v);
  if (m) return jourUtc(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}
function jourUtc(a: number, m: number, j: number): Date | null {
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j ? d : null;
}

function parseBool(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (["oui", "true", "1", "yes", "o", "x"].includes(v)) return true;
  if (["non", "false", "0", "no", "n", ""].includes(v)) return false;
  return null;
}

function parseIntCsv(value: string): number | null {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && /^[+-]?\d+$/.test(value.trim()) ? n : null;
}

/** La virgule décimale est acceptée : c'est celle que tape un tableur français. */
function parseFloatCsv(value: string): number | null {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
}

/** Équipement actif portant ce nom (vue 360°) : relier en CSV par le nom plutôt que par un id. */
async function lookupEquipment(name: string): Promise<number | null> {
  const e = await prisma.equipment.findFirst({
    where: { name, isActive: true },
    select: { id: true },
  });
  return e?.id ?? null;
}

/** La valeur active de la liste `kind` que désigne ce texte : son libellé (casse ignorée), ou l'ancienne clé d'avant le passage en référentiel. */
async function lookupReferential(kind: string, value: string): Promise<number | null> {
  const anciennes: Record<string, Record<string, string>> = {
    cert_usage: CERT_USAGE_LABELS,
    cert_support: CERT_SUPPORT_LABELS,
  };
  let texte = value.trim();
  texte = anciennes[kind]?.[texte.toLowerCase()] ?? texte;
  const rows = await prisma.referential.findMany({ where: { kind, isActive: true } });
  return rows.find((r) => r.label.toLowerCase() === texte.toLowerCase())?.id ?? null;
}

/** Neutralise l'injection de formules CSV : une cellule commençant par = + - @ (ou tabulation / retour chariot) est préfixée d'une apostrophe. */
export function csvSafe(text: string): string {
  return text && ["=", "+", "-", "@", "\t", "\r"].includes(text[0]) ? `'${text}` : text;
}

function fmt(value: unknown, kind: Kind): string {
  if (value === null || value === undefined) return "";
  if (kind === "date")
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (kind === "bool") return value ? "oui" : "non";
  if (kind === "equipment_ref" || kind.startsWith("ref:")) {
    const lie = value as { name?: string; label?: string };
    return csvSafe(String(lie.name ?? lie.label ?? ""));
  }
  return csvSafe(String(value));
}

/** Le champ Prisma à écrire pour une colonne de référence. */
function champCible(col: Colonne): string {
  if (col.kind === "equipment_ref") return "equipmentId";
  if (col.kind === "ref:cert_usage") return "usageId";
  if (col.kind === "ref:cert_support") return "supportId";
  return col.champ;
}

async function parse(value: string | undefined, kind: Kind): Promise<unknown> {
  const v = (value ?? "").trim();
  if (v === "") return null;
  if (kind === "date") return parseDateCsv(v);
  if (kind === "bool") return parseBool(v);
  if (kind === "int") return parseIntCsv(v);
  if (kind === "float") return parseFloatCsv(v);
  if (kind === "equipment_ref") return lookupEquipment(v);
  if (kind.startsWith("ref:")) return lookupReferential(kind.slice(4), v);
  return v;
}

// ── Écriture ──

const BOM = "﻿";

function cellule(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function ecrire(lignes: string[][]): string {
  return `${BOM}${lignes.map((l) => l.map(cellule).join(";")).join("\r\n")}\r\n`;
}

export async function exportCsv(key: string): Promise<string> {
  const spec = SPECS[key];
  const rows = await spec.charger();
  const lignes = [spec.columns.map((col) => col.csv)];
  for (const row of rows) lignes.push(spec.columns.map((col) => fmt(row[col.champ], col.kind)));
  return ecrire(lignes);
}

export function templateCsv(key: string): string {
  const spec = SPECS[key];
  return ecrire([
    spec.columns.map((col) => col.csv),
    spec.columns.map((col) => spec.example[col.csv] ?? ""),
  ]);
}

// ── Lecture ──

/** Un CSV en lignes de champs (guillemets, séparateur détecté sur la première ligne). */
export function lireCsv(text: string): string[][] {
  const premiere = text.split(/\r?\n/)[0] ?? "";
  const sep =
    (premiere.match(/;/g)?.length ?? 0) >= (premiere.match(/,/g)?.length ?? 0) ? ";" : ",";
  const lignes: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let guillemets = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (guillemets) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          champ += '"';
          i++;
        } else guillemets = false;
      } else champ += ch;
    } else if (ch === '"') guillemets = true;
    else if (ch === sep) {
      ligne.push(champ);
      champ = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else champ += ch;
  }
  if (champ !== "" || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes;
}

/** Importe des enregistrements. Retourne [nb créés, erreurs]. */
export async function importCsv(key: string, raw: Buffer): Promise<[number, string[]]> {
  const spec = SPECS[key];
  const text = raw.toString("utf8").replace(/^﻿/, "");
  if (!text.trim()) return [0, []];
  const [entete, ...corps] = lireCsv(text);
  // tolère les en-têtes avec espaces / casse
  const colonnes = entete.map((h) => h.trim().toLowerCase());
  const keyCol = spec.columns[0].csv.toLowerCase();
  let created = 0;
  const errors: string[] = [];
  for (const [i, valeurs] of corps.entries()) {
    const ligneNo = i + 2;
    if (valeurs.every((v) => v.trim() === "")) continue;
    const norm = Object.fromEntries(colonnes.map((nom, j) => [nom, valeurs[j] ?? ""]));
    if (!(norm[keyCol] ?? "").trim()) continue;
    try {
      const data: Ligne = {};
      for (const col of spec.columns) {
        const val = await parse(norm[col.csv.toLowerCase()], col.kind);
        if (val !== null && val !== undefined) data[champCible(col)] = val;
      }
      spec.post?.(data);
      await spec.creer(data);
      created += 1;
    } catch (e) {
      errors.push(
        `Ligne ${ligneNo} : ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`,
      );
    }
  }
  return [created, errors];
}

/** Réponse HTTP d'un CSV en pièce jointe. */
export function reponseCsv(content: string, filename: string): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
