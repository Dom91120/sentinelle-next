/**
 * La page Préférences (port du GET de auth.preferences) : tout ce que le gabarit
 * recevait, lu dans la configuration vivante (config-store), jamais dans l'env.
 */
import {
  ALERT_CATEGORIES,
  ALERT_CATEGORY_LABELS,
  type AlertCategory,
  CONFORMITY_CATEGORIES,
  CONFORMITY_LABELS,
  DEFAULT_THRESHOLDS,
  type Triplet,
} from "@/lib/constantes";
import { getConformityCategories } from "@/server/app-settings";
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { type BackupInfo, dbSizeMb, listBackups } from "@/server/db-backup";
import { enabledIn, FEATURES, type FeatureName } from "@/server/features";
import { getO365UserEmail, isO365Connected } from "@/server/mailer";

export type Module = { name: FeatureName; label: string; help: string; on: boolean };

/** Les modules débrayables et leur état, pour la rubrique Modules. */
export function modulesContext(cfg: AppSettings): Module[] {
  return (Object.keys(FEATURES) as FeatureName[]).map((name) => ({
    name,
    label: FEATURES[name][1],
    help: FEATURES[name][2],
    on: enabledIn(cfg, name),
  }));
}

export type Preferences = Awaited<ReturnType<typeof contextePreferences>>;

export async function contextePreferences(cfg: AppSettings) {
  const [
    o365Connected,
    o365UserEmail,
    dbBackups,
    dbTailleMo,
    conformityIncluded,
    conformitySetting,
  ] = await Promise.all([
    isO365Connected(),
    getO365UserEmail(),
    listBackups(cfg),
    dbSizeMb(),
    getConformityCategories(),
    prisma.setting.findUnique({ where: { key: "conformity_categories" } }),
  ]);
  const mailMethod = cfg.MAIL_METHOD || "smtp";
  const o365 = {
    client_id: cfg.O365_CLIENT_ID || "",
    client_secret: cfg.O365_CLIENT_SECRET || "",
    tenant_id: cfg.O365_TENANT_ID || "",
    sender_email: cfg.O365_SENDER_EMAIL || "",
    redirect_uri: cfg.O365_REDIRECT_URI || "http://127.0.0.1:3000/auth/o365/callback",
  };
  const smtp = {
    server: cfg.MAIL_SERVER || "",
    port: cfg.MAIL_PORT || 587,
    username: cfg.MAIL_USERNAME || "",
    sender: cfg.MAIL_DEFAULT_SENDER || "",
  };
  const alertRecipients = (cfg.ALERT_RECIPIENTS ?? []).join(", ");
  const alertRecipientsByCat = Object.fromEntries(
    ALERT_CATEGORIES.map((cat) => [
      cat,
      ((cfg[`ALERT_RECIPIENTS_${cat.toUpperCase()}`] as string[] | undefined) ?? []).join(", "),
    ]),
  ) as Record<AlertCategory, string>;
  const thresholds: Record<string, Triplet> = {
    expiry: cfg.THRESHOLD_EXPIRY ?? DEFAULT_THRESHOLDS.THRESHOLD_EXPIRY,
    domain: cfg.THRESHOLD_DOMAIN ?? DEFAULT_THRESHOLDS.THRESHOLD_DOMAIN,
    task: cfg.THRESHOLD_TASK ?? DEFAULT_THRESHOLDS.THRESHOLD_TASK,
    contract: cfg.THRESHOLD_CONTRACT ?? DEFAULT_THRESHOLDS.THRESHOLD_CONTRACT,
  };
  const ldap = {
    enabled: Boolean(cfg.LDAP_ENABLED),
    server: cfg.LDAP_SERVER || "",
    port: cfg.LDAP_PORT || 389,
    ssl: Boolean(cfg.LDAP_USE_SSL),
    validate_cert: cfg.LDAP_VALIDATE_CERT !== false,
    ca_cert: cfg.LDAP_CA_CERT || "",
    domain: cfg.LDAP_DOMAIN || "",
    base_dn: cfg.LDAP_BASE_DN || "",
    required_group: cfg.LDAP_REQUIRED_GROUP || "",
    default_role: cfg.LDAP_DEFAULT_ROLE || "viewer",
    bind_user: cfg.LDAP_BIND_USER || "",
    bind_set: Boolean(cfg.LDAP_BIND_PASSWORD),
  };
  const o365AppConfigured = Boolean(o365.client_id && o365.client_secret && o365.tenant_id);
  const mailConfigured =
    mailMethod === "o365"
      ? o365Connected && o365AppConfigured
      : Boolean(smtp.server && (smtp.sender || smtp.username));
  const thrDefaults: Record<string, Triplet> = {
    expiry: [7, 15, 30],
    domain: [30, 60, 90],
    task: [7, 15, 30],
  };
  const configured = {
    mail: mailConfigured,
    recipients: Boolean(alertRecipients.trim()),
    ldap: ldap.enabled,
    conformity: conformitySetting !== null,
    thresholds: Object.keys(thrDefaults).some(
      (k) => thresholds[k].join(",") !== thrDefaults[k].join(","),
    ),
    db: dbBackups.length > 0,
  };
  return {
    mailMethod,
    mailEnabled: cfg.MAIL_ENABLED !== false,
    configured,
    mailConfigured,
    o365,
    smtp,
    o365Connected,
    o365UserEmail,
    o365AppConfigured,
    alertRecipients,
    alertRecipientsByCat,
    alertCategoryLabels: ALERT_CATEGORY_LABELS,
    reportSchedule: cfg.REPORT_SCHEDULE || "off",
    reportRecipients: (cfg.REPORT_RECIPIENTS ?? []).join(", "),
    ctMonitoring: cfg.CT_MONITORING !== false,
    softwareAlerts: cfg.SOFTWARE_ALERTS !== false,
    modules: modulesContext(cfg),
    dashboardCustom: cfg.DASHBOARD_CUSTOM !== false,
    paginationMemory: cfg.PAGINATION_MEMORY !== false,
    ficheNavigation: cfg.FICHE_NAVIGATION !== false,
    softwareFormLegacy: Boolean(cfg.SOFTWARE_FORM_LEGACY),
    contractFormLegacy: Boolean(cfg.CONTRACT_FORM_LEGACY),
    supplierFormLegacy: Boolean(cfg.SUPPLIER_FORM_LEGACY),
    documentsEnabled: cfg.DOCUMENTS_ENABLED !== false,
    documentMaxMb: cfg.DOCUMENT_MAX_MB || 10,
    documentInlineView: cfg.DOCUMENT_INLINE_VIEW !== false,
    uiPrimaryColor: cfg.UI_PRIMARY_COLOR || "",
    dbBackups: dbBackups as BackupInfo[],
    thresholds,
    dbTailleMo,
    backupDbKeep: cfg.BACKUP_DB_KEEP || 14,
    ldap,
    conformityCategories: CONFORMITY_CATEGORIES,
    conformityLabels: CONFORMITY_LABELS,
    conformityIncluded: new Set<string>(conformityIncluded),
  };
}

/** Adresses saisies : virgules, points-virgules, espaces et retours à la ligne acceptés ; dédoublonnées dans l'ordre. */
export function parseEmails(raw: string | null | undefined): string[] {
  const parts = (raw ?? "")
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}
