/**
 * Les tâches planifiées (port des jobs de app/scheduler.py), appelées par /api/cron
 * selon le registre (jobs-registre.ts). Chaque exécution est journalisée dans
 * scheduler_run (succès / erreur), les 500 dernières conservées.
 */

import { EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { aujourdhui, dateCourte } from "@/lib/libelles";
import {
  backupExpectedIntervalDays,
  backupLastOkCheck,
  backupTodayCheck,
  certificateLabel,
  certificateMonitored,
  contractActionDeadline,
  contractDaysLeft,
  contractKindLabel,
  joursRestants,
  seuil,
  softwareOverLicence,
} from "@/lib/statuts";
import { FREQ_LABELS, scanInbox } from "@/modules/backups/server";
import { refreshCertificateTls } from "@/modules/certificates/server";
import { refreshDomainRdap, runCtScan } from "@/modules/domains/server";
import { hostingLabel } from "@/modules/software/server";
import { sendAlert, shouldSendReminder } from "@/server/alerts";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { backupDatabase } from "@/server/db-backup";
import { buildDailyDigest } from "@/server/digest";
import { chargerTout, type Tout } from "@/server/donnees";
import { refreshAll } from "@/server/eol";
import { enabledIn } from "@/server/features";
import { syncPasswordExpirations } from "@/server/ldap";
import { journal } from "@/server/log";
import { sendEmail } from "@/server/mailer";
import { sendReport } from "@/server/pdf-report";
import { isSnoozed } from "@/server/snooze";

const JOUR = 86_400_000;

async function checkPasswords(tout: Tout): Promise<void> {
  const today = aujourdhui();
  const thresholds = seuil(tout.seuils, "THRESHOLD_EXPIRY");
  for (const account of tout.accounts) {
    if (!account.nextPasswordChange) continue;
    if (await isSnoozed("account", account.id)) continue;
    const daysLeft = joursRestants(account.nextPasswordChange, today) ?? 0;
    if (await shouldSendReminder("account", account.id, daysLeft, thresholds)) {
      const urgency = daysLeft < 0 ? "EXPIRÉ" : `expire dans ${daysLeft} jour(s)`;
      const body = `Le mot de passe du compte suivant ${urgency}:\n\nService: ${account.serviceName}\nUtilisateur: ${account.username}\nProchain changement: ${dateCourte(account.nextPasswordChange)}\nJours restants: ${daysLeft}\n`;
      await sendAlert(
        `Alerte mot de passe - ${account.serviceName}`,
        body,
        "account",
        account.id,
        `${account.serviceName} (${account.username})`,
      );
    }
  }
}

async function checkCertificates(tout: Tout): Promise<void> {
  if (!enabledIn(tout.settings, "certificates")) return; // module coupé dans les Préférences : plus d'alerte
  const today = aujourdhui();
  const thresholds = seuil(tout.seuils, "THRESHOLD_EXPIRY");
  // Un certificat révoqué n'est plus utilisable : sa date ne veut plus rien dire, et l'alerte non plus.
  for (const cert of tout.certificates.filter((c) => certificateMonitored(c))) {
    if (await isSnoozed("certificate", cert.id)) continue;
    const daysLeft = joursRestants(cert.expiryDate, today) ?? 0; // monitored() garantit la date
    if (await shouldSendReminder("certificate", cert.id, daysLeft, thresholds)) {
      const urgency = daysLeft < 0 ? "EXPIRÉ" : `expire dans ${daysLeft} jour(s)`;
      const body = `Le certificat suivant ${urgency}:\n\nService: ${cert.serviceName}\nDomaine: ${cert.domain}\nÉmetteur: ${cert.issuer}\nDate d'expiration: ${cert.expiryDate ? dateCourte(cert.expiryDate) : ""}\nJours restants: ${daysLeft}\nAuto-renouvellement: ${cert.autoRenew ? "Oui" : "Non"}\n`;
      await sendAlert(
        `Alerte certificat - ${certificateLabel(cert)}`,
        body,
        "certificate",
        cert.id,
        `${cert.serviceName} - ${cert.domain}`,
      );
    }
  }
}

async function checkBackups(tout: Tout): Promise<void> {
  const today = aujourdhui();
  for (const backup of tout.backups) {
    if (backup.status !== "danger") continue;
    if (await isSnoozed("backup", backup.id)) continue;
    const todayCheck = backupTodayCheck(backup.checks, today);
    const lastOk = backupLastOkCheck(backup.checks);
    const daysSince = lastOk
      ? Math.floor((today.getTime() - lastOk.checkDate.getTime()) / JOUR)
      : null;
    const freq = FREQ_LABELS[backup.frequency ?? ""] ?? backup.frequency ?? "Non definie";
    let detail: string;
    if (todayCheck && todayCheck.status === "failed")
      detail = `Le check du jour est en ECHEC (${(todayCheck as { comment?: string | null }).comment || "sans commentaire"})`;
    else if (lastOk)
      detail = `Dernier backup OK le ${dateCourte(lastOk.checkDate)} (il y a ${daysSince} j ; cadence attendue : ${freq.toLowerCase()} / ${backupExpectedIntervalDays(backup.frequency)} j)`;
    else detail = "Aucun backup OK enregistre pour ce service";
    const body = `Le backup suivant necessite une attention:\n\nService: ${backup.serviceName}\nType: ${backup.backupType}\nEmplacement: ${backup.location}\nFrequence: ${freq}\n${detail}\n`;
    await sendAlert(
      `Alerte backup - ${backup.serviceName}`,
      body,
      "backup",
      backup.id,
      backup.serviceName,
    );
  }
}

async function checkTests(tout: Tout): Promise<void> {
  const today = aujourdhui();
  const thresholds = seuil(tout.seuils, "THRESHOLD_TASK");
  for (const test of tout.tests) {
    if (await isSnoozed("test", test.id)) continue;
    const daysLeft = test.nextDue ? joursRestants(test.nextDue, today) : null;
    // On alerte si l'échéance approche/est dépassée, OU si le dernier résultat est un échec.
    const due =
      daysLeft !== null && (await shouldSendReminder("test", test.id, daysLeft, thresholds));
    const ko =
      test.brut === "failed" && (await shouldSendReminder("test", test.id, -1, thresholds));
    if (!(due || ko)) continue;
    const urgency =
      test.brut === "failed"
        ? "EN ECHEC"
        : daysLeft === null
          ? "a planifier"
          : daysLeft < 0
            ? "EN RETARD"
            : `prévu dans ${daysLeft} jour(s)`;
    const prevue = test.nextDue ? dateCourte(test.nextDue) : "non planifiée";
    const body = `Le test suivant est ${urgency}:\n\nNom: ${test.name}\nType: ${test.testType}\nDate prévue: ${prevue}\nJours restants: ${daysLeft ?? "N/A"}\n`;
    await sendAlert(`Alerte test - ${test.name}`, body, "test", test.id, test.name);
  }
}

async function checkDomains(tout: Tout): Promise<void> {
  const today = aujourdhui();
  const thresholds = seuil(tout.seuils, "THRESHOLD_DOMAIN");
  for (const domain of tout.domains) {
    if (!domain.expiryDate || (await isSnoozed("domain", domain.id))) continue;
    const daysLeft = joursRestants(domain.expiryDate, today) ?? 0;
    if (await shouldSendReminder("domain", domain.id, daysLeft, thresholds)) {
      const urgency = daysLeft < 0 ? "EXPIRÉ" : `expire dans ${daysLeft} jour(s)`;
      const body = `Le nom de domaine suivant ${urgency}:\n\nDomaine: ${domain.name}\nRegistrar: ${domain.registrar || "N/A"}\nDate d'expiration: ${dateCourte(domain.expiryDate)}\nJours restants: ${daysLeft}\nRenouvellement auto: ${domain.autoRenew ? "Oui" : "Non"}\n`;
      await sendAlert(`Alerte domaine - ${domain.name}`, body, "domain", domain.id, domain.name);
    }
  }
}

/** Alerte sur les contrats dont la date limite d'action approche (échéance - préavis de résiliation). */
async function checkContracts(tout: Tout): Promise<void> {
  const today = aujourdhui();
  const thresholds = seuil(tout.seuils, "THRESHOLD_CONTRACT");
  for (const contract of tout.contracts) {
    const daysLeft = contractDaysLeft(contract, today);
    if (daysLeft === null || (await isSnoozed("contract", contract.id))) continue;
    if (await shouldSendReminder("contract", contract.id, daysLeft, thresholds)) {
      const urgency = daysLeft < 0 ? "DEPASSEE" : `dans ${daysLeft} jour(s)`;
      const deadline = contractActionDeadline(contract);
      const body =
        `La date limite d'action du contrat suivant est ${urgency}:\n\nContrat: ${contract.name}\nType: ${contractKindLabel(contract)}\nFournisseur: ${contract.supplier?.name ?? "N/A"}\n` +
        `Echeance: ${contract.endDate ? dateCourte(contract.endDate) : ""}\nPreavis de resiliation: ${contract.noticeDays || 0} jour(s)\nAgir avant le: ${deadline ? dateCourte(deadline) : ""}\nTacite reconduction: ${contract.autoRenew ? "Oui" : "Non"}\n`;
      await sendAlert(
        `Alerte contrat - ${contract.name}`,
        body,
        "contract",
        contract.id,
        contract.name,
      );
    }
  }
}

/** Lit en direct l'expiration RDAP de chaque domaine actif. */
async function refreshDomainsRdap(): Promise<void> {
  for (const domain of await prisma.domain.findMany({ where: { isActive: true } })) {
    try {
      await refreshDomainRdap(domain, "auto-rdap");
    } catch (e) {
      journal.avert("rdap", "rafraîchissement échoué", { domaine: domain.name, erreur: e });
    }
  }
}

/** Synchronise l'expiration des mots de passe depuis l'AD (compte de service). */
async function syncAdPasswords(cfg: AppSettings): Promise<void> {
  try {
    const [updated, errors] = await syncPasswordExpirations(cfg);
    journal.info("ldap", "Synchro AD", { maj: updated, erreurs: errors.length });
  } catch (e) {
    journal.erreur("ldap", "Echec synchro AD", { erreur: e });
  }
}

async function checkReviews(tout: Tout): Promise<void> {
  const today = aujourdhui();
  const thresholds = seuil(tout.seuils, "THRESHOLD_TASK");
  for (const review of tout.reviews) {
    if (await isSnoozed("review", review.id)) continue;
    const daysLeft = review.nextReview ? joursRestants(review.nextReview, today) : null;
    const due =
      daysLeft !== null && (await shouldSendReminder("review", review.id, daysLeft, thresholds));
    const ko =
      review.brut === "failed" && (await shouldSendReminder("review", review.id, -1, thresholds));
    if (!(due || ko)) continue;
    const urgency =
      review.brut === "failed"
        ? "EN ECHEC"
        : daysLeft === null
          ? "a planifier"
          : daysLeft < 0
            ? "EN RETARD"
            : `prevue dans ${daysLeft} jour(s)`;
    const prochaine = review.nextReview ? dateCourte(review.nextReview) : "non planifiée";
    const body = `La revue de droits suivante est ${urgency}:\n\nApplication: ${review.application}\nResponsable: ${review.responsible || "N/A"}\nProchaine revue: ${prochaine}\nJours restants: ${daysLeft ?? "N/A"}\n`;
    await sendAlert(
      `Alerte revue de droits - ${review.application}`,
      body,
      "review",
      review.id,
      review.application,
    );
  }
}

async function checkUpdates(tout: Tout): Promise<void> {
  for (const upd of tout.updates) {
    if (upd.brut !== "critical" || (await isSnoozed("update", upd.id))) continue;
    const body = `Une mise a jour critique est en attente:\n\nElement: ${upd.name}\nVersion actuelle: ${upd.currentVersion || "N/A"}\nDerniere version: ${upd.latestVersion || "N/A"}\n`;
    await sendAlert(`Alerte mise a jour critique - ${upd.name}`, body, "update", upd.id, upd.name);
  }
}

function osUpdateStale(
  e: { os: string | null; osLastUpdate: Date | null },
  limit: number,
  today: Date,
): boolean {
  if (!e.os && !e.osLastUpdate) return false;
  if (!e.osLastUpdate) return true;
  return Math.floor((today.getTime() - e.osLastUpdate.getTime()) / JOUR) > limit;
}

async function checkInventory(tout: Tout): Promise<void> {
  const today = aujourdhui();
  const thresholds = seuil(tout.seuils, "THRESHOLD_WARRANTY");
  const isMonday = today.getUTCDay() === 1;
  const staleDays = tout.settings.OS_STALE_DAYS;
  for (const e of tout.equipments) {
    if (await isSnoozed("equipment", e.id)) continue;
    const reasons: string[] = [];
    if (e.warrantyEnd) {
      const dl = joursRestants(e.warrantyEnd, today) ?? 0;
      if (await shouldSendReminder("equipment", e.id, dl, thresholds))
        reasons.push(
          dl < 0
            ? "Garantie EXPIRÉE"
            : `Garantie expire dans ${dl} jour(s) (${dateCourte(e.warrantyEnd)})`,
        );
    }
    // Points hebdomadaires (le lundi) pour éviter le bruit quotidien.
    const missingBackup =
      (e.criticality ?? 0) >= 3 && !e.backup1 && !e.backup2 && !e.hasActiveBackup;
    if (isMonday && missingBackup) reasons.push("Criticité élevée sans sauvegarde renseignée");
    if (isMonday && osUpdateStale(e, staleDays, today))
      reasons.push("Mise à jour OS absente ou trop ancienne");
    if (isMonday && e.eol?.status === "danger" && e.eol.eol_date)
      reasons.push(`OS en fin de support depuis le ${dateCourte(e.eol.eol_date)}`);
    if (!reasons.length) continue;
    const body = `L'équipement suivant nécessite une attention :\n\nNom : ${e.name}\nType : ${EQUIPMENT_KIND_LABELS[e.kind] ?? e.kind}\nCriticité : ${e.criticality ?? "N/A"}\n\n${reasons.map((r) => `- ${r}`).join("\n")}\n`;
    await sendAlert(
      `Alerte inventaire - ${e.name}`,
      body,
      "equipment",
      e.id,
      e.name,
      e.status === "danger" ? "danger" : "warning",
    );
  }
}

/** Alertes sur les logiciels : fin de vie sans successeur, plafond de licences dépassé. Le lundi seulement. */
export async function checkSoftware(tout: Tout, today = aujourdhui()): Promise<void> {
  if (tout.settings.SOFTWARE_ALERTS === false) return;
  if (today.getUTCDay() !== 1) return;
  for (const sw of tout.software) {
    if (await isSnoozed("software", sw.id)) continue;
    const reasons: string[] = [];
    if (sw.lifecycle === "fin_de_vie") reasons.push("En fin de vie : un successeur est à trouver");
    if (softwareOverLicence(sw))
      reasons.push(
        `Plafond de licences dépassé : ${sw.usersCount} utilisateurs pour ${sw.usersMax} prévus au contrat`,
      );
    if (!reasons.length) continue;
    const body = `Le logiciel suivant nécessite une attention :\n\nNom : ${sw.name}${sw.version ? ` ${sw.version}` : ""}\nÉditeur : ${sw.supplier?.name ?? "N/A"}\nHébergement : ${hostingLabel(sw)}\nResponsable : ${sw.responsible || "N/A"}\n\n${reasons.map((r) => `- ${r}`).join("\n")}\n`;
    await sendAlert(
      `Alerte logiciel - ${sw.name}`,
      body,
      "software",
      sw.id,
      sw.name,
      sw.status === "danger" ? "danger" : "warning",
    );
  }
}

/** Lit en direct la date d'expiration réelle de chaque certificat TLS actif. */
async function refreshCertificatesTls(cfg: AppSettings): Promise<void> {
  if (!enabledIn(cfg, "certificates")) return;
  for (const cert of await prisma.certificate.findMany({
    where: { isActive: true, kind: "tls" },
  })) {
    try {
      await refreshCertificateTls(cert, "auto-tls");
    } catch (e) {
      journal.avert("tls", "rafraîchissement échoué", { certificat: cert.id, erreur: e });
    }
  }
}

async function refreshEolCache(): Promise<void> {
  const [ok, total] = await refreshAll();
  journal.info("eol", "Cache EOL rafraichi", { ok, total });
}

/** Envoie le récapitulatif quotidien de la météo DSI (un seul email). */
async function sendDailyDigest(cfg: AppSettings): Promise<void> {
  const recipients = (cfg.ALERT_RECIPIENTS ?? []).map((r) => r.trim()).filter(Boolean);
  if (!recipients.length) return;
  const digest = await buildDailyDigest(cfg.APP_BASE_URL || "");
  let status = "sent";
  let message = digest.text;
  try {
    await sendEmail(digest.subject, recipients, digest.text, digest.html, undefined, cfg);
  } catch (e) {
    status = "failed";
    message = `ERREUR: ${e instanceof Error ? e.message : String(e)}\n${digest.text}`;
  }
  await prisma.alertLog.create({
    data: {
      alertType: "digest",
      entityType: "digest",
      entityName: "Meteo quotidienne",
      message,
      recipients: recipients.join(", "),
      status,
    },
  });
}

/** Envoie le bilan PDF selon la planification : weekly = chaque lundi, monthly = le 1er du mois. */
async function sendScheduledReport(cfg: AppSettings): Promise<void> {
  const schedule = (cfg.REPORT_SCHEDULE || "off").toLowerCase();
  const today = aujourdhui();
  const due =
    (schedule === "weekly" && today.getUTCDay() === 1) ||
    (schedule === "monthly" && today.getUTCDate() === 1);
  if (!due) return;
  try {
    const recipients = await sendReport(cfg);
    await prisma.alertLog.create({
      data: {
        alertType: "report",
        entityType: "report",
        entityName: "Bilan PDF",
        message: `Bilan PDF envoye (${schedule})`,
        recipients: recipients.join(", "),
        status: "sent",
      },
    });
  } catch (e) {
    await prisma.alertLog.create({
      data: {
        alertType: "report",
        entityType: "report",
        entityName: "Bilan PDF",
        message: `ERREUR: ${e instanceof Error ? e.message : String(e)}`,
        recipients: "",
        status: "failed",
      },
    });
  }
}

async function backupDatabaseJob(cfg: AppSettings): Promise<void> {
  const chemin = await backupDatabase(cfg);
  journal.info("base", "Sauvegarde base creee", { chemin });
}

async function scanBackupInbox(cfg: AppSettings): Promise<void> {
  if (!cfg.BACKUP_INBOX_DIR) return;
  await scanInbox(cfg.BACKUP_INBOX_DIR);
}

/** Les tâches par identifiant (ceux du registre et de la page Tâches planifiées). */
export const TACHES: Record<
  string,
  (cfg: AppSettings, tout: () => Promise<Tout>) => Promise<void>
> = {
  scan_backup_inbox: (cfg) => scanBackupInbox(cfg),
  backup_database_job: (cfg) => backupDatabaseJob(cfg),
  sync_ad_passwords: (cfg) => syncAdPasswords(cfg),
  refresh_eol_cache: () => refreshEolCache(),
  refresh_certificates_tls: (cfg) => refreshCertificatesTls(cfg),
  refresh_domains_rdap: () => refreshDomainsRdap(),
  check_ct_logs: () => runCtScan(),
  send_daily_digest: (cfg) => sendDailyDigest(cfg),
  send_scheduled_report: (cfg) => sendScheduledReport(cfg),
  check_domains: async (_c, t) => checkDomains(await t()),
  check_passwords: async (_c, t) => checkPasswords(await t()),
  check_certificates: async (_c, t) => checkCertificates(await t()),
  check_backups: async (_c, t) => checkBackups(await t()),
  check_tests: async (_c, t) => checkTests(await t()),
  check_reviews: async (_c, t) => checkReviews(await t()),
  check_updates: async (_c, t) => checkUpdates(await t()),
  check_inventory: async (_c, t) => checkInventory(await t()),
  check_software: async (_c, t) => checkSoftware(await t()),
  check_contracts: async (_c, t) => checkContracts(await t()),
};

/** Journalise une exécution (succès/erreur) et ne garde que les 500 dernières. */
async function journaliser(jobId: string, erreur: unknown): Promise<void> {
  try {
    await prisma.schedulerRun.create({
      data: {
        jobId,
        status: erreur ? "error" : "ok",
        message: erreur ? (erreur instanceof Error ? erreur.message : String(erreur)) : null,
      },
    });
    const vieux = await prisma.schedulerRun.findMany({
      orderBy: { id: "desc" },
      skip: 500,
      select: { id: true },
    });
    if (vieux.length)
      await prisma.schedulerRun.deleteMany({ where: { id: { in: vieux.map((r) => r.id) } } });
  } catch (e) {
    console.error("[scheduler] journalisation impossible :", e);
  }
}

export type Resultat = { id: string; ok: boolean; erreur?: string };

/** Exécute une tâche par son identifiant, et la journalise. */
export async function executerTache(id: string, cfgIn?: AppSettings): Promise<Resultat> {
  const fn = TACHES[id];
  if (!fn) return { id, ok: false, erreur: "tâche inconnue" };
  const cfg = cfgIn ?? (await getSettings());
  let tout: Promise<Tout> | null = null;
  const chargeur = () => {
    if (!tout) tout = chargerTout();
    return tout;
  };
  try {
    await fn(cfg, chargeur);
    await journaliser(id, null);
    return { id, ok: true };
  } catch (e) {
    journal.erreur("scheduler", `tâche ${id} en erreur`, { erreur: e });
    await journaliser(id, e);
    return { id, ok: false, erreur: e instanceof Error ? e.message : String(e) };
  }
}

/** Exécute, dans l'ordre, les tâches données (une à la fois : elles partagent la base et la messagerie). */
export async function executerTaches(ids: string[]): Promise<Resultat[]> {
  const cfg = await getSettings();
  const out: Resultat[] = [];
  for (const id of ids) out.push(await executerTache(id, cfg));
  return out;
}
