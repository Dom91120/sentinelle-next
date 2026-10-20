/**
 * Paliers de statut (vert/orange/rouge) des modèles : c'est la logique dont dépendent le
 * tableau de bord et toutes les alertes (port de tests/test_statuts.py).
 */
import { describe, expect, it } from "vitest";
import { aujourdhui } from "./libelles";
import {
  accountStatus,
  backupComputedStatus,
  certificateStatus,
  domainStatus,
  equipmentComputedStatus,
  missingBackup,
  osUpdateStale,
  reviewComputedStatus,
  testComputedStatus,
  updateStatusColor,
  warrantyStatus,
} from "./statuts";

const jour = (offset: number) => new Date(aujourdhui().getTime() + offset * 86_400_000);
const cert = (expiryDate: Date | null, validity: string | null = "valide") => ({
  kind: "tls",
  serviceName: "svc",
  domain: "exemple.fr",
  expiryDate,
  validity,
  isActive: true,
});

describe("seuils à date (comptes, certificats, domaines, tests, revues)", () => {
  it("certificat : paliers THRESHOLD_EXPIRY 7 / 15 / 30", () => {
    const cas: [number, string][] = [
      [-5, "danger"],
      [0, "danger"],
      [7, "danger"],
      [8, "warning"],
      [15, "warning"],
      [16, "info"],
      [30, "info"],
      [31, "success"],
    ];
    for (const [days, attendu] of cas)
      expect(certificateStatus(cert(jour(days))), `J+${days}`).toBe(attendu);
  });

  it("compte : paliers et sans date", () => {
    expect(accountStatus({ nextPasswordChange: null })).toBe("warning");
    expect(accountStatus({ nextPasswordChange: jour(3) })).toBe("danger");
    expect(accountStatus({ nextPasswordChange: jour(60) })).toBe("success");
  });

  it("domaine : paliers THRESHOLD_DOMAIN 30 / 60 / 90", () => {
    const cas: [number, string][] = [
      [30, "danger"],
      [31, "warning"],
      [60, "warning"],
      [61, "info"],
      [90, "info"],
      [91, "success"],
    ];
    for (const [days, attendu] of cas)
      expect(domainStatus({ expiryDate: jour(days) }), `J+${days}`).toBe(attendu);
    expect(domainStatus({ expiryDate: null })).toBe("warning");
  });

  it("test récurrent : statuts", () => {
    expect(testComputedStatus({ status: "failed", nextDue: null })).toBe("danger");
    expect(testComputedStatus({ status: "completed", nextDue: null })).toBe("success");
    expect(testComputedStatus({ status: "pending", nextDue: null })).toBe("warning"); // sans next_due
    expect(testComputedStatus({ status: "pending", nextDue: jour(5) })).toBe("danger");
    expect(testComputedStatus({ status: "pending", nextDue: jour(45) })).toBe("success");
  });

  it("revue de droits : statuts", () => {
    expect(reviewComputedStatus({ status: "failed", nextReview: null })).toBe("danger");
    expect(reviewComputedStatus({ status: "pending", nextReview: null })).toBe("warning");
    expect(reviewComputedStatus({ status: "pending", nextReview: jour(10) })).toBe("warning");
  });

  it("mise à jour : couleurs", () => {
    const cas: [string, string][] = [
      ["up_to_date", "success"],
      ["update_available", "warning"],
      ["critical", "danger"],
      ["inconnu", "info"],
    ];
    for (const [status, attendu] of cas)
      expect(updateStatusColor({ status }), status).toBe(attendu);
  });
});

describe("sauvegardes : statut selon la fréquence et la tolérance", () => {
  /** Check au jour J+offset (checked_at cohérent avec check_date). */
  const check = (offset: number, status = "ok") => ({
    checkDate: jour(offset),
    status,
    firstStatus: status,
    checkedAt: new Date(Date.now() + offset * 86_400_000),
  });

  it("check du jour", () => {
    for (const [status, attendu] of [
      ["ok", "success"],
      ["warning", "warning"],
      ["failed", "danger"],
    ]) {
      expect(
        backupComputedStatus({ frequency: "daily" }, [check(0, status)]),
        `check ${status}`,
      ).toBe(attendu);
    }
  });

  it("quotidien en retard : période 1 j, tolérance 1 j", () => {
    for (const [offset, attendu] of [
      [-1, "success"],
      [-2, "warning"],
      [-3, "danger"],
    ] as [number, string][]) {
      expect(
        backupComputedStatus({ frequency: "daily" }, [check(offset)]),
        `dernier OK J${offset}`,
      ).toBe(attendu);
    }
  });

  it("hebdo pas en retard à tort : période 7 j, tolérance 2 j", () => {
    for (const [offset, attendu] of [
      [-7, "success"],
      [-9, "warning"],
      [-10, "danger"],
    ] as [number, string][]) {
      expect(
        backupComputedStatus({ frequency: "weekly" }, [check(offset)]),
        `dernier OK J${offset}`,
      ).toBe(attendu);
    }
  });

  it("mensuel : période 31 j, tolérance 5 j", () => {
    for (const [offset, attendu] of [
      [-31, "success"],
      [-36, "warning"],
      [-37, "danger"],
    ] as [number, string][]) {
      expect(
        backupComputedStatus({ frequency: "monthly" }, [check(offset)]),
        `dernier OK J${offset}`,
      ).toBe(attendu);
    }
  });

  it("sans historique", () => {
    expect(backupComputedStatus({ frequency: "daily" }, [])).toBe("info"); // jamais vérifié
    expect(backupComputedStatus({ frequency: "daily" }, [check(-1, "failed")])).toBe("warning"); // jamais OK
  });
});

describe("inventaire", () => {
  const equip = (
    o: Partial<{
      criticality: number | null;
      os: string | null;
      osLastUpdate: Date | null;
      warrantyEnd: Date | null;
      backup1: string | null;
      backup2: string | null;
    }> = {},
  ) => ({
    criticality: null,
    os: null,
    osLastUpdate: null,
    warrantyEnd: null,
    backup1: null,
    backup2: null,
    ...o,
  });

  it("garantie : paliers THRESHOLD_WARRANTY 30 / 60 / 90", () => {
    const cas: [number, string][] = [
      [10, "danger"],
      [45, "warning"],
      [75, "info"],
      [120, "success"],
    ];
    for (const [days, attendu] of cas)
      expect(warrantyStatus(equip({ warrantyEnd: jour(days) })), `garantie J+${days}`).toBe(
        attendu,
      );
    expect(warrantyStatus(equip())).toBeNull();
  });

  it("criticité élevée sans sauvegarde", () => {
    expect(missingBackup(equip({ criticality: 3 }), false)).toBe(true);
    expect(
      equipmentComputedStatus(equip({ criticality: 3 }), { hasActiveBackup: false, eol: null }),
    ).toBe("danger");
    // criticité faible : pas concerné
    expect(missingBackup(equip({ criticality: 2 }), false)).toBe(false);
    // champ texte renseigné : couvert
    expect(missingBackup(equip({ criticality: 4, backup1: "Veeam" }), false)).toBe(false);
  });

  it("un backup actif lié à l'équipement vaut sauvegarde (vue 360°)", () => {
    expect(missingBackup(equip({ criticality: 4 }), false)).toBe(true);
    expect(missingBackup(equip({ criticality: 4 }), true)).toBe(false);
  });

  it("MAJ OS obsolète", () => {
    expect(osUpdateStale(equip())).toBe(false); // rien renseigné
    expect(osUpdateStale(equip({ os: "Debian" }))).toBe(true); // OS sans date
    expect(osUpdateStale(equip({ os: "Debian", osLastUpdate: jour(-400) }))).toBe(true);
    expect(osUpdateStale(equip({ os: "Debian", osLastUpdate: jour(-100) }))).toBe(false);
  });
});
