/**
 * Configuration applicative persistée en base (table app_config) — port de
 * app/config_store.py et des défauts de config.py.
 *
 * - Le `.env` ne sert que pour l'amorçage et comme repli.
 * - Les valeurs sensibles (mots de passe, secrets) sont chiffrées (AES-256-GCM,
 *   clé dérivée de BETTER_AUTH_SECRET — cf. server/secret-crypto.ts).
 */
import { ALERT_CATEGORIES, DEFAULT_THRESHOLDS, type Triplet } from "@/lib/constantes";
import { prisma } from "@/server/db";
import { decryptSecret, encryptSecret } from "@/server/secret-crypto";

/** Clés dont la valeur est un secret → chiffrée en base. */
export const SECRET_KEYS = new Set([
  "MAIL_PASSWORD",
  "O365_CLIENT_SECRET",
  "LDAP_BIND_PASSWORD",
  "SESAME_API_TOKEN",
  "CHATIA_API_TOKEN",
]);

export const BOOL_KEYS = new Set([
  "MAIL_ENABLED",
  "LDAP_ENABLED",
  "LDAP_USE_SSL",
  "LDAP_VALIDATE_CERT",
  "CT_MONITORING",
  "SESAME_API_ENABLED",
  "CHATIA_API_ENABLED",
  "DASHBOARD_CUSTOM",
  "PAGINATION_MEMORY",
  "FICHE_NAVIGATION",
  "DOCUMENTS_ENABLED",
  "DOCUMENT_INLINE_VIEW",
  "SOFTWARE_ALERTS",
  "SOFTWARE_FORM_LEGACY",
  "CONTRACT_FORM_LEGACY",
  "SUPPLIER_FORM_LEGACY",
  "QUOTES_ENABLED",
  "GDPR_ENABLED",
  "SOFTWARE_LINKS_ENABLED",
  "CERTIFICATES_ENABLED",
]);
export const INT_KEYS = new Set(["LDAP_PORT", "MAIL_PORT", "DOCUMENT_MAX_MB", "BACKUP_DB_KEEP"]);
export const TRIPLET_KEYS = new Set([
  "THRESHOLD_EXPIRY",
  "THRESHOLD_DOMAIN",
  "THRESHOLD_TASK",
  "THRESHOLD_CONTRACT",
]);
export const CSV_KEYS = new Set([
  "ALERT_RECIPIENTS",
  "REPORT_RECIPIENTS",
  ...ALERT_CATEGORIES.map((c) => `ALERT_RECIPIENTS_${c.toUpperCase()}`),
]);

/** Ensemble des clés gérées en base (= celles écrites par la page Préférences). */
export const MANAGED = new Set<string>([
  ...BOOL_KEYS,
  ...INT_KEYS,
  ...TRIPLET_KEYS,
  ...CSV_KEYS,
  "MAIL_METHOD",
  "MAIL_SERVER",
  "MAIL_USERNAME",
  "MAIL_PASSWORD",
  "MAIL_DEFAULT_SENDER",
  "O365_CLIENT_ID",
  "O365_CLIENT_SECRET",
  "O365_TENANT_ID",
  "O365_SENDER_EMAIL",
  "O365_REDIRECT_URI",
  "LDAP_SERVER",
  "LDAP_CA_CERT",
  "LDAP_DOMAIN",
  "LDAP_BASE_DN",
  "LDAP_REQUIRED_GROUP",
  "LDAP_DEFAULT_ROLE",
  "LDAP_BIND_USER",
  "LDAP_BIND_PASSWORD",
  "TEAMS_WEBHOOK_URL",
  "SLACK_WEBHOOK_URL",
  "DISCORD_WEBHOOK_URL",
  "REPORT_SCHEDULE",
  "SESAME_API_TOKEN",
  "CHATIA_API_TOKEN",
  "UI_PRIMARY_COLOR",
]);

/** Réglages NON gérés en base (amorçage et sécurité), lus dans l'environnement seul. */
export type EnvOnly = {
  SESSION_LIFETIME_MINUTES: number;
  PASSWORD_MIN_LENGTH: number;
  LOGIN_MAX_ATTEMPTS: number;
  LOGIN_LOCKOUT_MINUTES: number;
  REQUIRE_2FA_ADMIN: boolean;
  TRUST_PROXY: boolean;
  LDAP_USER_DN_TEMPLATE: string;
  MAIL_USE_TLS: boolean;
  THRESHOLD_WARRANTY: Triplet;
  OS_STALE_DAYS: number;
  APP_BASE_URL: string;
  BACKUP_INGEST_TOKEN: string;
  BACKUP_INBOX_DIR: string;
  BACKUP_DB_DIR: string;
  ADMIN_EMAIL: string;
};

/** La configuration vivante, typée comme `app.config` de Flask. */
export type AppSettings = EnvOnly & {
  MAIL_ENABLED: boolean;
  MAIL_METHOD: string;
  MAIL_SERVER: string;
  MAIL_PORT: number;
  MAIL_USERNAME: string;
  MAIL_PASSWORD: string;
  MAIL_DEFAULT_SENDER: string;
  O365_CLIENT_ID: string;
  O365_CLIENT_SECRET: string;
  O365_TENANT_ID: string;
  O365_SENDER_EMAIL: string;
  O365_REDIRECT_URI: string;
  ALERT_RECIPIENTS: string[];
  REPORT_SCHEDULE: string;
  REPORT_RECIPIENTS: string[];
  LDAP_ENABLED: boolean;
  LDAP_SERVER: string;
  LDAP_PORT: number;
  LDAP_USE_SSL: boolean;
  LDAP_VALIDATE_CERT: boolean;
  LDAP_CA_CERT: string;
  LDAP_DOMAIN: string;
  LDAP_BASE_DN: string;
  LDAP_REQUIRED_GROUP: string;
  LDAP_DEFAULT_ROLE: string;
  LDAP_BIND_USER: string;
  LDAP_BIND_PASSWORD: string;
  THRESHOLD_EXPIRY: Triplet;
  THRESHOLD_DOMAIN: Triplet;
  THRESHOLD_TASK: Triplet;
  THRESHOLD_CONTRACT: Triplet;
  CT_MONITORING: boolean;
  SOFTWARE_ALERTS: boolean;
  QUOTES_ENABLED: boolean;
  GDPR_ENABLED: boolean;
  SOFTWARE_LINKS_ENABLED: boolean;
  CERTIFICATES_ENABLED: boolean;
  DOCUMENTS_ENABLED: boolean;
  DOCUMENT_MAX_MB: number;
  DOCUMENT_INLINE_VIEW: boolean;
  DASHBOARD_CUSTOM: boolean;
  PAGINATION_MEMORY: boolean;
  FICHE_NAVIGATION: boolean;
  SOFTWARE_FORM_LEGACY: boolean;
  CONTRACT_FORM_LEGACY: boolean;
  SUPPLIER_FORM_LEGACY: boolean;
  UI_PRIMARY_COLOR: string;
  TEAMS_WEBHOOK_URL: string;
  SLACK_WEBHOOK_URL: string;
  DISCORD_WEBHOOK_URL: string;
  SESAME_API_ENABLED: boolean;
  SESAME_API_TOKEN: string;
  CHATIA_API_ENABLED: boolean;
  CHATIA_API_TOKEN: string;
  BACKUP_DB_KEEP: number;
  [key: string]: unknown;
};

function envBool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  return ["true", "1", "yes", "on"].includes(v.toLowerCase());
}
function envInt(name: string, def: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) ? n : def;
}
function envStr(name: string, def = ""): string {
  return process.env[name] ?? def;
}
function envTriplet(name: string, def: Triplet): Triplet {
  const parts = (process.env[name] ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isInteger(n))) {
    return [parts[0], parts[1], parts[2]];
  }
  return def;
}
function envCsv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Les défauts de config.py, lus dans l'environnement. */
export function envDefaults(): AppSettings {
  const host = envStr("APP_HOST", "127.0.0.1");
  const port = envStr("APP_PORT", "3000");
  return {
    SESSION_LIFETIME_MINUTES: envInt("SESSION_LIFETIME_MINUTES", 480),
    PASSWORD_MIN_LENGTH: envInt("PASSWORD_MIN_LENGTH", 8),
    LOGIN_MAX_ATTEMPTS: envInt("LOGIN_MAX_ATTEMPTS", 5),
    LOGIN_LOCKOUT_MINUTES: envInt("LOGIN_LOCKOUT_MINUTES", 15),
    REQUIRE_2FA_ADMIN: envBool("REQUIRE_2FA_ADMIN", false),
    TRUST_PROXY: envBool("TRUST_PROXY", false),
    LDAP_USER_DN_TEMPLATE: envStr("LDAP_USER_DN_TEMPLATE"),
    MAIL_USE_TLS: envBool("MAIL_USE_TLS", true),
    THRESHOLD_WARRANTY: envTriplet("THRESHOLD_WARRANTY", DEFAULT_THRESHOLDS.THRESHOLD_WARRANTY),
    OS_STALE_DAYS: envInt("OS_STALE_DAYS", 365),
    APP_BASE_URL: envStr(
      "APP_BASE_URL",
      process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? `http://${host}:${port}`,
    ),
    BACKUP_INGEST_TOKEN: envStr("BACKUP_INGEST_TOKEN"),
    BACKUP_INBOX_DIR: envStr("BACKUP_INBOX_DIR"),
    BACKUP_DB_DIR: envStr("BACKUP_DB_DIR"),
    ADMIN_EMAIL: envStr("ADMIN_EMAIL"),

    MAIL_ENABLED: envBool("MAIL_ENABLED", true),
    MAIL_METHOD: envStr("MAIL_METHOD", "smtp"),
    MAIL_SERVER: envStr("MAIL_SERVER", "localhost"),
    MAIL_PORT: envInt("MAIL_PORT", 587),
    MAIL_USERNAME: envStr("MAIL_USERNAME"),
    MAIL_PASSWORD: envStr("MAIL_PASSWORD"),
    MAIL_DEFAULT_SENDER: envStr("MAIL_DEFAULT_SENDER", "noreply@localhost"),
    O365_CLIENT_ID: envStr("O365_CLIENT_ID"),
    O365_CLIENT_SECRET: envStr("O365_CLIENT_SECRET"),
    O365_TENANT_ID: envStr("O365_TENANT_ID"),
    O365_SENDER_EMAIL: envStr("O365_SENDER_EMAIL"),
    O365_REDIRECT_URI: envStr("O365_REDIRECT_URI", "http://127.0.0.1:3000/auth/o365/callback"),
    ALERT_RECIPIENTS: envCsv("ALERT_RECIPIENTS"),
    ...Object.fromEntries(
      ALERT_CATEGORIES.map((c) => [`ALERT_RECIPIENTS_${c.toUpperCase()}`, [] as string[]]),
    ),
    REPORT_SCHEDULE: envStr("REPORT_SCHEDULE", "off"),
    REPORT_RECIPIENTS: envCsv("REPORT_RECIPIENTS"),
    LDAP_ENABLED: envBool("LDAP_ENABLED", false),
    LDAP_SERVER: envStr("LDAP_SERVER"),
    LDAP_PORT: envInt("LDAP_PORT", 389),
    LDAP_USE_SSL: envBool("LDAP_USE_SSL", false),
    LDAP_VALIDATE_CERT: envBool("LDAP_VALIDATE_CERT", true),
    LDAP_CA_CERT: envStr("LDAP_CA_CERT"),
    LDAP_DOMAIN: envStr("LDAP_DOMAIN"),
    LDAP_BASE_DN: envStr("LDAP_BASE_DN"),
    LDAP_REQUIRED_GROUP: envStr("LDAP_REQUIRED_GROUP"),
    LDAP_DEFAULT_ROLE: envStr("LDAP_DEFAULT_ROLE", "viewer"),
    LDAP_BIND_USER: envStr("LDAP_BIND_USER"),
    LDAP_BIND_PASSWORD: envStr("LDAP_BIND_PASSWORD"),
    THRESHOLD_EXPIRY: envTriplet("THRESHOLD_EXPIRY", DEFAULT_THRESHOLDS.THRESHOLD_EXPIRY),
    THRESHOLD_DOMAIN: envTriplet("THRESHOLD_DOMAIN", DEFAULT_THRESHOLDS.THRESHOLD_DOMAIN),
    THRESHOLD_TASK: envTriplet("THRESHOLD_TASK", DEFAULT_THRESHOLDS.THRESHOLD_TASK),
    THRESHOLD_CONTRACT: envTriplet("THRESHOLD_CONTRACT", DEFAULT_THRESHOLDS.THRESHOLD_CONTRACT),
    CT_MONITORING: envBool("CT_MONITORING", true),
    SOFTWARE_ALERTS: envBool("SOFTWARE_ALERTS", true),
    QUOTES_ENABLED: envBool("QUOTES_ENABLED", true),
    GDPR_ENABLED: envBool("GDPR_ENABLED", true),
    SOFTWARE_LINKS_ENABLED: envBool("SOFTWARE_LINKS_ENABLED", true),
    CERTIFICATES_ENABLED: envBool("CERTIFICATES_ENABLED", true),
    DOCUMENTS_ENABLED: envBool("DOCUMENTS_ENABLED", true),
    DOCUMENT_MAX_MB: envInt("DOCUMENT_MAX_MB", 10),
    DOCUMENT_INLINE_VIEW: envBool("DOCUMENT_INLINE_VIEW", true),
    DASHBOARD_CUSTOM: envBool("DASHBOARD_CUSTOM", true),
    PAGINATION_MEMORY: envBool("PAGINATION_MEMORY", true),
    FICHE_NAVIGATION: envBool("FICHE_NAVIGATION", true),
    SOFTWARE_FORM_LEGACY: envBool("SOFTWARE_FORM_LEGACY", false),
    CONTRACT_FORM_LEGACY: envBool("CONTRACT_FORM_LEGACY", false),
    SUPPLIER_FORM_LEGACY: envBool("SUPPLIER_FORM_LEGACY", false),
    UI_PRIMARY_COLOR: envStr("UI_PRIMARY_COLOR"),
    TEAMS_WEBHOOK_URL: envStr("TEAMS_WEBHOOK_URL"),
    SLACK_WEBHOOK_URL: envStr("SLACK_WEBHOOK_URL"),
    DISCORD_WEBHOOK_URL: envStr("DISCORD_WEBHOOK_URL"),
    SESAME_API_ENABLED: envBool("SESAME_API_ENABLED", false),
    SESAME_API_TOKEN: envStr("SESAME_API_TOKEN"),
    CHATIA_API_ENABLED: envBool("CHATIA_API_ENABLED", false),
    CHATIA_API_TOKEN: envStr("CHATIA_API_TOKEN"),
    BACKUP_DB_KEEP: envInt("BACKUP_DB_KEEP", 14),
  };
}

/** Convertit la chaîne stockée vers le type attendu. */
export function cast(key: string, raw: string | null | undefined): unknown {
  const r = raw ?? "";
  if (BOOL_KEYS.has(key)) return ["true", "1", "yes", "on"].includes(String(r).toLowerCase());
  if (INT_KEYS.has(key)) {
    const n = Number.parseInt(String(r), 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (TRIPLET_KEYS.has(key)) {
    const parts = String(r)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isInteger(n))) return parts as unknown as Triplet;
    return null;
  }
  if (CSV_KEYS.has(key)) {
    return String(r)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return r;
}

/** Convertit une valeur typée vers la chaîne à stocker. */
export function serialize(key: string, value: unknown): string {
  if (BOOL_KEYS.has(key)) return value ? "true" : "false";
  if (TRIPLET_KEYS.has(key)) return ((value as number[] | null) ?? []).join(",");
  if (CSV_KEYS.has(key)) return ((value as string[] | null) ?? []).join(",");
  if (value === null || value === undefined) return "";
  return String(value);
}

// Cache en mémoire de processus : rechargé à la première lecture, invalidé à
// chaque écriture, et au plus toutes les 60 s (plusieurs instances).
const CACHE_TTL_MS = 60_000;
let cache: { at: number; settings: AppSettings } | null = null;

/** Applique les réglages stockés en base sur les défauts de l'environnement. */
async function load(): Promise<AppSettings> {
  const settings = envDefaults();
  try {
    const rows = await prisma.appConfig.findMany();
    for (const row of rows) {
      if (!MANAGED.has(row.key)) continue;
      const raw = row.isSecret ? decryptSecret(row.value ?? "") : (row.value ?? "");
      const v = cast(row.key, raw);
      if (TRIPLET_KEYS.has(row.key) && v === null) continue;
      settings[row.key] = v;
    }
  } catch (e) {
    console.error("[config-store] lecture de app_config impossible :", e);
  }
  return settings;
}

/** La configuration vivante (base + repli env), mémoïsée 60 s. */
export async function getSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.settings;
  const settings = await load();
  cache = { at: Date.now(), settings };
  return settings;
}

/** Force la relecture au prochain appel. */
export function invalidateSettings(): void {
  cache = null;
}

/** Persiste un dict {CLÉ: valeur-chaîne} en base (chiffre les secrets). */
export async function saveSettings(updates: Record<string, string | null | undefined>): Promise<void> {
  const ops = Object.entries(updates).map(([key, val]) => {
    const v = val === null || val === undefined ? "" : String(val);
    const secret = SECRET_KEYS.has(key);
    const stored = secret ? encryptSecret(v) : v;
    return prisma.appConfig.upsert({
      where: { key },
      update: { value: stored, isSecret: secret },
      create: { key, value: stored, isSecret: secret },
    });
  });
  if (ops.length) await prisma.$transaction(ops);
  invalidateSettings();
}

/** Migration initiale : si la table est vide, on y copie les valeurs du .env. */
export async function seedFromEnv(): Promise<number> {
  const first = await prisma.appConfig.findFirst({ select: { key: true } });
  if (first) return 0;
  const defaults = envDefaults();
  const rows = [...MANAGED].map((key) => {
    const secret = SECRET_KEYS.has(key);
    const s = serialize(key, defaults[key]);
    return { key, value: secret ? encryptSecret(s) : s, isSecret: secret };
  });
  await prisma.appConfig.createMany({ data: rows });
  invalidateSettings();
  return rows.length;
}

/** Seuils effectifs (THRESHOLD_*), pour la logique de statut. */
export function seuilsDe(s: AppSettings): Record<string, Triplet> {
  return {
    THRESHOLD_EXPIRY: s.THRESHOLD_EXPIRY,
    THRESHOLD_DOMAIN: s.THRESHOLD_DOMAIN,
    THRESHOLD_TASK: s.THRESHOLD_TASK,
    THRESHOLD_CONTRACT: s.THRESHOLD_CONTRACT,
    THRESHOLD_WARRANTY: s.THRESHOLD_WARRANTY,
  };
}
