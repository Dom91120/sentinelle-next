/**
 * Logique de statut (vert / orange / rouge) des fiches, portée depuis les
 * méthodes des modèles SQLAlchemy (app/models.py). Fonctions PURES : elles
 * reçoivent la fiche et les seuils effectifs, et ne font aucune requête.
 */
import {
  BACKUP_FREQ_PERIOD,
  BACKUP_FREQ_TOLERANCE,
  CERT_SUPPORT_LABELS,
  CERT_USAGE_LABELS,
  CIVILITY_LABELS,
  CONTRACT_KIND_LABELS,
  DEFAULT_THRESHOLDS,
  type Statut,
  statusFromDays,
  type Triplet,
} from "@/lib/constantes";
import { aujourdhui, dateCourte, diffJours } from "@/lib/libelles";

export type Seuils = Record<string, Triplet>;

export function seuil(seuils: Seuils | undefined, key: string): Triplet {
  return seuils?.[key] ?? DEFAULT_THRESHOLDS[key];
}

/** Jours restants avant une date (négatif = dépassée), null sans date. */
export function joursRestants(d: Date | null | undefined, today = aujourdhui()): number | null {
  return d ? diffJours(d, today) : null;
}

// ── Comptes ──
export function accountStatus(
  a: { nextPasswordChange: Date | null },
  seuils?: Seuils,
  today = aujourdhui(),
): Statut {
  if (!a.nextPasswordChange) return "warning";
  return statusFromDays(diffJours(a.nextPasswordChange, today), seuil(seuils, "THRESHOLD_EXPIRY"));
}

// ── Certificats ──
export type CertificateLike = {
  kind: string;
  serviceName: string;
  domain: string | null;
  expiryDate: Date | null;
  validity: string | null;
  isActive: boolean;
  civility?: string | null;
  holder?: string | null;
  firstName?: string | null;
  certUsageCode?: string | null;
  supportCode?: string | null;
  certUsage?: { label: string } | null;
  support?: { label: string } | null;
};

export function certificateHolderLabel(c: CertificateLike): string {
  const bouts = [CIVILITY_LABELS[c.civility ?? ""] ?? "", c.holder, c.firstName];
  return bouts.filter(Boolean).join(" ");
}

/** Le nom de la fiche, dans les listes, les alertes et les bilans. */
export function certificateLabel(c: CertificateLike): string {
  if (c.kind === "signature") {
    const qui = certificateHolderLabel(c);
    return qui ? `${c.serviceName} - ${qui}` : c.serviceName;
  }
  return c.domain ? `${c.serviceName} - ${c.domain}` : c.serviceName;
}

export function certificateUsageLabel(c: CertificateLike): string {
  if (c.certUsage) return c.certUsage.label;
  return CERT_USAGE_LABELS[c.certUsageCode ?? ""] ?? "";
}

export function certificateSupportLabel(c: CertificateLike): string {
  if (c.support) return c.support.label;
  return CERT_SUPPORT_LABELS[c.supportCode ?? ""] ?? "";
}

/** Ce certificat compte-t-il encore parmi les échéances ? */
export function certificateMonitored(c: CertificateLike): boolean {
  return c.isActive && c.validity !== "revoque" && c.expiryDate !== null;
}

export function certificateStatus(
  c: CertificateLike,
  seuils?: Seuils,
  today = aujourdhui(),
): Statut {
  if (c.expiryDate === null) return "warning";
  if (c.validity === "revoque") return "success";
  return statusFromDays(diffJours(c.expiryDate, today), seuil(seuils, "THRESHOLD_EXPIRY"));
}

// ── Sauvegardes ──
export type BackupCheckLike = {
  checkDate: Date;
  status: string;
  firstStatus: string | null;
  checkedAt: Date;
};

export function backupExpectedIntervalDays(frequency: string | null): number {
  return BACKUP_FREQ_PERIOD[frequency ?? ""] ?? 1;
}
export function backupToleranceDays(frequency: string | null): number {
  return BACKUP_FREQ_TOLERANCE[frequency ?? ""] ?? 1;
}

/** Le pointage du jour (checked_at aujourd'hui), s'il existe. */
export function backupTodayCheck(
  checks: BackupCheckLike[],
  today = aujourdhui(),
): BackupCheckLike | undefined {
  return checks.find((c) => diffJours(c.checkedAt, today) === 0);
}

/** Le dernier pointage OK (par check_date décroissante). */
export function backupLastOkCheck(checks: BackupCheckLike[]): BackupCheckLike | undefined {
  return [...checks]
    .filter((c) => c.status === "ok")
    .sort((a, b) => b.checkDate.getTime() - a.checkDate.getTime())[0];
}

/** Statut tenant compte de la fréquence : un backup hebdo/mensuel n'est pas en retard
 * simplement parce qu'il n'a pas tourné aujourd'hui. */
export function backupComputedStatus(
  b: { frequency: string | null },
  checks: BackupCheckLike[],
  today = aujourdhui(),
): Statut {
  const tc = backupTodayCheck(checks, today);
  if (tc) {
    if (tc.status === "failed") return "danger";
    if (tc.status === "warning") return "warning";
    if (tc.status === "ok") return "success";
  }
  const lastOk = backupLastOkCheck(checks);
  if (!lastOk) return checks.length > 0 ? "warning" : "info";
  const daysSince = -diffJours(lastOk.checkDate, today);
  const period = backupExpectedIntervalDays(b.frequency);
  const tolerance = backupToleranceDays(b.frequency);
  if (daysSince <= period) return "success";
  if (daysSince <= period + tolerance) return "warning";
  return "danger";
}

/** Taux de réussite sur `days` jours, basé sur le PREMIER état de chaque jour. */
export function backupSuccessRate(
  checks: BackupCheckLike[],
  days = 30,
  now = new Date(),
): number | null {
  const since = now.getTime() - days * 86_400_000;
  const recents = checks.filter((c) => c.checkedAt.getTime() >= since);
  if (recents.length === 0) return null;
  const ok = recents.filter((c) => (c.firstStatus || c.status) === "ok").length;
  return Math.round((ok / recents.length) * 1000) / 10;
}

/** Série de pointages OK consécutifs (du plus récent vers le passé, 365 au plus). */
export function backupStreak(checks: BackupCheckLike[]): number {
  const tri = [...checks]
    .sort((a, b) => b.checkDate.getTime() - a.checkDate.getTime())
    .slice(0, 365);
  let count = 0;
  for (const c of tri) {
    if ((c.firstStatus || c.status) === "ok") count += 1;
    else break;
  }
  return count;
}

// ── Tests récurrents ──
export function testComputedStatus(
  t: { status: string | null; nextDue: Date | null },
  seuils?: Seuils,
  today = aujourdhui(),
): Statut {
  if (t.status === "failed") return "danger";
  if (t.status === "completed") return "success";
  if (!t.nextDue) return "warning";
  return statusFromDays(diffJours(t.nextDue, today), seuil(seuils, "THRESHOLD_TASK"));
}

// ── Revues de droits ──
export function reviewComputedStatus(
  r: { status: string | null; nextReview: Date | null },
  seuils?: Seuils,
  today = aujourdhui(),
): Statut {
  if (r.status === "failed") return "danger";
  if (!r.nextReview) return "warning";
  return statusFromDays(diffJours(r.nextReview, today), seuil(seuils, "THRESHOLD_TASK"));
}

// ── Mises à jour ──
export function updateStatusColor(u: { status: string | null }): Statut {
  const m: Record<string, Statut> = {
    up_to_date: "success",
    update_available: "warning",
    critical: "danger",
  };
  return m[u.status ?? ""] ?? "info";
}

// ── Domaines ──
export function domainStatus(
  d: { expiryDate: Date | null },
  seuils?: Seuils,
  today = aujourdhui(),
): Statut {
  if (!d.expiryDate) return "warning";
  return statusFromDays(diffJours(d.expiryDate, today), seuil(seuils, "THRESHOLD_DOMAIN"));
}

/** La fiche de domaine dont relève ce nom d'hôte (le plus long l'emporte). */
export function domainForHost<T extends { name: string }>(
  host: string | null,
  domaines: T[],
): T | null {
  const h = (host ?? "").trim().toLowerCase().replace(/\.+$/, "");
  if (!h) return null;
  let meilleur: T | null = null;
  for (const d of domaines) {
    const nom = (d.name ?? "").trim().toLowerCase().replace(/\.+$/, "");
    if (nom && (h === nom || h.endsWith(`.${nom}`))) {
      if (meilleur === null || nom.length > meilleur.name.trim().length) meilleur = d;
    }
  }
  return meilleur;
}

// ── Inventaire matériel ──
export type EolInfo = {
  status?: Statut | null;
  eol_date?: Date | null;
  days_left?: number | null;
  [k: string]: unknown;
} | null;

export type EquipmentLike = {
  criticality: number | null;
  os: string | null;
  osLastUpdate: Date | null;
  warrantyEnd: Date | null;
  backup1: string | null;
  backup2: string | null;
};

export function warrantyDaysLeft(e: EquipmentLike, today = aujourdhui()): number | null {
  return e.warrantyEnd ? diffJours(e.warrantyEnd, today) : null;
}

export function warrantyStatus(
  e: EquipmentLike,
  seuils?: Seuils,
  today = aujourdhui(),
): Statut | null {
  const d = warrantyDaysLeft(e, today);
  if (d === null) return null;
  return statusFromDays(d, seuil(seuils, "THRESHOLD_WARRANTY"));
}

/** MAJ OS jamais renseignée ou trop ancienne (seuil configurable, 365 j par défaut). */
export function osUpdateStale(e: EquipmentLike, limit = 365, today = aujourdhui()): boolean {
  if (!e.os && !e.osLastUpdate) return false;
  if (!e.osLastUpdate) return true;
  return -diffJours(e.osLastUpdate, today) > limit;
}

/** Criticité élevée sans aucune sauvegarde connue (texte ou backup actif lié). */
export function missingBackup(e: EquipmentLike, hasActiveBackup: boolean): boolean {
  if ((e.criticality ?? 0) < 3) return false;
  if (e.backup1 || e.backup2) return false;
  return !hasActiveBackup;
}

export function equipmentComputedStatus(
  e: EquipmentLike,
  ctx: { hasActiveBackup: boolean; eol: EolInfo; osStaleDays?: number },
  seuils?: Seuils,
  today = aujourdhui(),
): Statut {
  const found = new Set<Statut>();
  const ws = warrantyStatus(e, seuils, today);
  if (ws) found.add(ws);
  if (missingBackup(e, ctx.hasActiveBackup)) found.add("danger");
  if (osUpdateStale(e, ctx.osStaleDays ?? 365, today)) found.add("warning");
  if (ctx.eol?.status) found.add(ctx.eol.status);
  for (const s of ["danger", "warning", "info", "success"] as Statut[]) {
    if (found.has(s)) return s;
  }
  return "success";
}

/** Liste lisible des points d'attention (fiche et alertes). */
export function equipmentStatusReasons(
  e: EquipmentLike,
  ctx: { hasActiveBackup: boolean; eol: EolInfo; osStaleDays?: number },
  today = aujourdhui(),
): string[] {
  const out: string[] = [];
  const d = warrantyDaysLeft(e, today);
  if (d !== null && d <= 90) out.push(d < 0 ? "Garantie expirée" : `Garantie expire dans ${d} j`);
  if (missingBackup(e, ctx.hasActiveBackup)) out.push("Criticité élevée sans sauvegarde");
  if (osUpdateStale(e, ctx.osStaleDays ?? 365, today)) out.push("MAJ OS absente ou trop ancienne");
  const ei = ctx.eol;
  if (ei && (ei.status === "danger" || ei.status === "warning")) {
    const dt = ei.eol_date;
    if (dt && ei.days_left != null && ei.days_left < 0) {
      out.push(`OS en fin de support depuis le ${dateCourte(dt)}`);
    } else if (dt) {
      out.push(`OS en fin de support le ${dateCourte(dt)}`);
    } else {
      out.push("OS en fin de support");
    }
  }
  return out;
}

// ── Contrats ──
export type ContractLike = {
  kind: string | null;
  kindRef?: { label: string } | null;
  startDate: Date | null;
  endDate: Date | null;
  noticeDays: number | null;
  renewals: number | null;
  renewalYears: number | null;
};

export function contractKindLabel(c: ContractLike): string {
  if (c.kindRef) return c.kindRef.label;
  return CONTRACT_KIND_LABELS[c.kind ?? ""] ?? c.kind ?? "";
}

/** « du 01/01/2023 au 31/12/2026 », et ce que l'on sait quand il manque une date. */
export function contractPeriodLabel(c: ContractLike): string {
  const d = c.startDate ? dateCourte(c.startDate) : null;
  const f = c.endDate ? dateCourte(c.endDate) : null;
  if (d && f) return `du ${d} au ${f}`;
  if (d) return `depuis le ${d}`;
  if (f) return `jusqu'au ${f}`;
  return "";
}

/** « renouvelable 2 fois par période de 1 an ». Zéro se dit aussi : « non reconductible ». */
export function contractRenewalLabel(c: ContractLike): string {
  if (c.renewals === null || c.renewals === undefined) return "";
  if (c.renewals === 0) return "non reconductible";
  const fois = "fois";
  if (c.renewalYears) {
    const an = c.renewalYears === 1 ? "an" : "ans";
    return `renouvelable ${c.renewals} ${fois} par période de ${c.renewalYears} ${an}`;
  }
  return `renouvelable ${c.renewals} ${fois}`;
}

/** Date limite pour agir : échéance moins le préavis de résiliation. */
export function contractActionDeadline(c: ContractLike): Date | null {
  if (!c.endDate) return null;
  const d = new Date(c.endDate.getTime());
  d.setUTCDate(d.getUTCDate() - (c.noticeDays ?? 0));
  return d;
}

export function contractDaysLeft(c: ContractLike, today = aujourdhui()): number | null {
  const deadline = contractActionDeadline(c);
  return deadline ? diffJours(deadline, today) : null;
}

export function contractStatus(c: ContractLike, seuils?: Seuils, today = aujourdhui()): Statut {
  const days = contractDaysLeft(c, today);
  if (days === null) return "warning";
  return statusFromDays(days, seuil(seuils, "THRESHOLD_CONTRACT"));
}

/** Le contrat court aujourd'hui : commencé (ou sans début) et pas encore échu (ou sans échéance). */
export function contractEnCours(c: ContractLike, today = aujourdhui()): boolean {
  const t = today.getTime();
  return (
    (c.startDate === null || c.startDate.getTime() <= t) &&
    (c.endDate === null || c.endDate.getTime() >= t)
  );
}

// ── Logiciels ──
/** Statut agrégé sur les MAJ liées : rouge si critique, orange si une MAJ est
 * disponible ou si le logiciel est en fin de vie, vert sinon. */
export function softwareComputedStatus(
  s: { lifecycle: string },
  updates: { status: string | null; isActive: boolean }[],
): Statut {
  const actives = updates.filter((u) => u.isActive);
  if (actives.some((u) => u.status === "critical")) return "danger";
  if (actives.some((u) => u.status === "update_available")) return "warning";
  if (s.lifecycle === "fin_de_vie") return "warning";
  return "success";
}

/** Hébergé hors parc. `hybride` compte comme SaaS. */
export function softwareIsSaas(s: { hosting: string }): boolean {
  return s.hosting === "saas" || s.hosting === "hybride";
}

/** Le plafond contractuel d'utilisateurs est-il dépassé ? null quand un nombre manque. */
export function softwareOverLicence(s: {
  usersCount: number | null;
  usersMax: number | null;
}): boolean | null {
  if (s.usersCount === null || s.usersMax === null) return null;
  return s.usersCount > s.usersMax;
}

/** Le flux vu de la fiche `softwareId` : 'sortant', 'entrant' ou 'double'. */
export function linkSensDepuis(
  l: { sourceId: number; targetId: number; bidirectional: boolean | null },
  softwareId: number,
): "sortant" | "entrant" | "double" {
  if (l.bidirectional) return "double";
  return l.sourceId === softwareId ? "sortant" : "entrant";
}
