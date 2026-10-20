/**
 * Le registre des tâches planifiées (port de start_scheduler dans app/scheduler.py) :
 * les mêmes identifiants et les mêmes heures. Le conteneur cron appelle
 * /api/cron/tous toutes les 5 minutes ; `tachesDues` dit lesquelles exécuter.
 */
import type { AppSettings } from "@/server/config-store";

export type Tache = { id: string; heure?: number; minute?: number; intervalleMinutes?: number; actif?: (cfg: AppSettings) => boolean };

export const TACHES: Tache[] = [
  { id: "scan_backup_inbox", intervalleMinutes: 30, actif: (cfg) => Boolean(cfg.BACKUP_INBOX_DIR) },
  { id: "backup_database_job", heure: 1, minute: 0 },
  { id: "sync_ad_passwords", heure: 6, minute: 0, actif: (cfg) => Boolean(cfg.LDAP_ENABLED && cfg.LDAP_BIND_USER) },
  { id: "refresh_eol_cache", heure: 6, minute: 50 },
  { id: "refresh_certificates_tls", heure: 7, minute: 0 },
  { id: "refresh_domains_rdap", heure: 7, minute: 10 },
  { id: "check_ct_logs", heure: 6, minute: 30 },
  { id: "send_daily_digest", heure: 7, minute: 30 },
  { id: "send_scheduled_report", heure: 7, minute: 40 },
  { id: "check_domains", heure: 8, minute: 20 },
  { id: "check_passwords", heure: 8, minute: 0 },
  { id: "check_certificates", heure: 8, minute: 15 },
  { id: "check_backups", heure: 8, minute: 30 },
  { id: "check_tests", heure: 8, minute: 45 },
  { id: "check_reviews", heure: 8, minute: 50 },
  { id: "check_updates", heure: 8, minute: 55 },
  { id: "check_inventory", heure: 8, minute: 58 },
  { id: "check_software", heure: 9, minute: 0 },
  { id: "check_contracts", heure: 8, minute: 40 },
];

/** Les tâches actives selon la configuration. */
export function tachesActives(cfg: AppSettings): Tache[] {
  return TACHES.filter((t) => !t.actif || t.actif(cfg));
}

/** La prochaine exécution d'une tâche (heure locale du serveur). */
export function prochaineExecution(t: Tache, now = new Date()): Date {
  if (t.intervalleMinutes) {
    const pas = t.intervalleMinutes * 60_000;
    return new Date(Math.ceil((now.getTime() + 1) / pas) * pas);
  }
  const d = new Date(now);
  d.setHours(t.heure ?? 0, t.minute ?? 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/** Les tâches dont l'heure tombe dans la fenêtre [depuis, jusqua[ (appel toutes les 5 min). */
export function tachesDues(cfg: AppSettings, depuis: Date, jusqua: Date): Tache[] {
  const dues: Tache[] = [];
  for (const t of tachesActives(cfg)) {
    if (t.intervalleMinutes) {
      const pas = t.intervalleMinutes * 60_000;
      const prochain = Math.ceil(depuis.getTime() / pas) * pas;
      if (prochain >= depuis.getTime() && prochain < jusqua.getTime()) dues.push(t);
      continue;
    }
    const d = new Date(depuis);
    d.setHours(t.heure ?? 0, t.minute ?? 0, 0, 0);
    for (const candidat of [d, new Date(d.getTime() + 86_400_000)]) {
      if (candidat.getTime() >= depuis.getTime() && candidat.getTime() < jusqua.getTime()) dues.push(t);
    }
  }
  return dues;
}
