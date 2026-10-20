/** Politique de rappel des alertes (partie pure de tests/test_alertes.py). */
import { describe, expect, it } from "vitest";
import type { Triplet } from "@/lib/constantes";
import { alertRecipientsFor, reminderDue } from "./alerts";
import { envDefaults } from "./config-store";

const TH: Triplet = [7, 15, 30];
const ilYA = (days: number) => new Date(Date.now() - days * 86_400_000);

describe("reminderDue", () => {
  it("hors fenêtre : pas d'alerte", () => {
    expect(reminderDue(45, TH, null)).toBe(false);
  });
  it("première alerte dans la fenêtre", () => {
    expect(reminderDue(20, TH, null)).toBe(true);
  });
  it("cadence warning : 7 jours", () => {
    expect(reminderDue(20, TH, ilYA(1))).toBe(false); // rappel trop récent
    expect(reminderDue(20, TH, ilYA(8))).toBe(true); // rattrapage
  });
  it("cadence danger : 2 jours", () => {
    expect(reminderDue(5, TH, ilYA(1))).toBe(false);
    expect(reminderDue(5, TH, ilYA(2))).toBe(true);
  });
  it("échu : rappel quotidien", () => {
    expect(reminderDue(-3, TH, ilYA(1))).toBe(true);
  });
  it("seuils invalides : pas d'alerte", () => {
    expect(reminderDue(5, null, null)).toBe(false);
    expect(reminderDue(5, [7, 15] as unknown as Triplet, null)).toBe(false);
  });
});

describe("alertRecipientsFor", () => {
  it("destinataires par catégorie", () => {
    const cfg = envDefaults();
    cfg.ALERT_RECIPIENTS = ["dsi@mairie.fr"];
    cfg.ALERT_RECIPIENTS_BACKUP = ["sauvegarde@mairie.fr"];
    cfg.ALERT_RECIPIENTS_CERTIFICATE = [];
    expect(alertRecipientsFor(cfg, "backup")).toEqual(["sauvegarde@mairie.fr"]); // liste dédiée définie → elle prime
    expect(alertRecipientsFor(cfg, "certificate")).toEqual(["dsi@mairie.fr"]); // liste dédiée vide → repli
    expect(alertRecipientsFor(cfg, null)).toEqual(["dsi@mairie.fr"]); // pas de type → globale
  });
});
