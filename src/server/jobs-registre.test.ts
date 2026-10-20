/** Le registre des tâches planifiées : les mêmes identifiants et horaires que app/scheduler.py. */
import { describe, expect, it } from "vitest";
import { envDefaults } from "./config-store";
import { TACHES, tachesActives, tachesDues } from "./jobs-registre";

describe("jobs-registre", () => {
  it("porte toutes les tâches de Sentinelle", () => {
    const ids = TACHES.map((t) => t.id);
    for (const id of [
      "scan_backup_inbox",
      "backup_database_job",
      "sync_ad_passwords",
      "refresh_eol_cache",
      "refresh_certificates_tls",
      "refresh_domains_rdap",
      "check_ct_logs",
      "send_daily_digest",
      "send_scheduled_report",
      "check_domains",
      "check_passwords",
      "check_certificates",
      "check_backups",
      "check_tests",
      "check_reviews",
      "check_updates",
      "check_inventory",
      "check_software",
      "check_contracts",
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it("la boîte de dépôt et la synchro AD ne tournent que si elles sont configurées", () => {
    const cfg = envDefaults();
    cfg.BACKUP_INBOX_DIR = "";
    cfg.LDAP_ENABLED = false;
    const actives = tachesActives(cfg).map((t) => t.id);
    expect(actives).not.toContain("scan_backup_inbox");
    expect(actives).not.toContain("sync_ad_passwords");
    cfg.BACKUP_INBOX_DIR = "/inbox";
    cfg.LDAP_ENABLED = true;
    cfg.LDAP_BIND_USER = "svc";
    const toutes = tachesActives(cfg).map((t) => t.id);
    expect(toutes).toContain("scan_backup_inbox");
    expect(toutes).toContain("sync_ad_passwords");
  });

  it("une fenêtre de cinq minutes attrape les tâches dont l'heure y tombe", () => {
    const cfg = envDefaults();
    cfg.BACKUP_INBOX_DIR = "";
    const depuis = new Date(2026, 9, 20, 7, 58, 0);
    const jusqua = new Date(2026, 9, 20, 8, 3, 0);
    const dues = tachesDues(cfg, depuis, jusqua).map((t) => t.id);
    expect(dues).toContain("check_passwords"); // 08:00
    expect(dues).not.toContain("check_certificates"); // 08:15
    expect(dues).not.toContain("send_scheduled_report"); // 07:40
  });

  it("une tâche à intervalle tombe quand un multiple de l'intervalle est dans la fenêtre", () => {
    const cfg = envDefaults();
    cfg.BACKUP_INBOX_DIR = "/inbox";
    const a = tachesDues(
      cfg,
      new Date(2026, 9, 20, 10, 28, 0),
      new Date(2026, 9, 20, 10, 33, 0),
    ).map((t) => t.id);
    expect(a).toContain("scan_backup_inbox");
    const b = tachesDues(
      cfg,
      new Date(2026, 9, 20, 10, 33, 0),
      new Date(2026, 9, 20, 10, 38, 0),
    ).map((t) => t.id);
    expect(b).not.toContain("scan_backup_inbox");
  });
});
