/**
 * Alertes logiciels : fin de vie sans successeur et plafond de licences dépassé, chaque
 * lundi, débrayables depuis Préférences et routées vers la catégorie « Logiciels »
 * (port de tests/test_alertes_logiciels.py).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientTest, clientAdmin } from "./setup/client";
import { creerUtilisateur, prisma, reglage, regler, resetDb } from "./setup/db";

vi.mock("@/server/alerts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/alerts")>();
  return { ...mod, sendAlert: vi.fn(async () => true) };
});

import { ALERT_CATEGORIES, ALERT_CATEGORY_LABELS, permissionCategory } from "@/lib/constantes";
import { alertRecipientsFor, sendAlert } from "@/server/alerts";
import { getSettings } from "@/server/config-store";
import { chargerTout } from "@/server/donnees";
import { isSnoozed, setSnooze } from "@/server/snooze";
import { checkSoftware } from "@/server/taches";

const LUNDI = new Date(Date.UTC(2026, 8, 21));
const MARDI = new Date(Date.UTC(2026, 8, 22));
const mock = vi.mocked(sendAlert);

beforeEach(async () => {
  await resetDb();
  mock.mockClear();
});

async function lancer(today: Date) {
  await checkSoftware(await chargerTout(), today);
  return mock;
}

describe("alertes logiciels", () => {
  it("fin de vie : alerte le lundi", async () => {
    await prisma.software.create({ data: { name: "Ciril", lifecycle: "fin_de_vie" } });
    const m = await lancer(LUNDI);
    expect(m).toHaveBeenCalledTimes(1);
    const [subject, body, entityType, , name, status] = m.mock.calls[0];
    expect(subject).toContain("Ciril");
    expect(body).toContain("fin de vie");
    expect(entityType).toBe("software");
    expect(name).toBe("Ciril");
    expect(status).toBe("warning");
  });

  it("pas d'alerte les autres jours", async () => {
    await prisma.software.create({ data: { name: "Ciril", lifecycle: "fin_de_vie" } });
    expect((await lancer(MARDI)).mock.calls).toHaveLength(0);
  });

  it("plafond de licences dépassé", async () => {
    await prisma.software.create({ data: { name: "Paie", usersCount: 60, usersMax: 50 } });
    const m = await lancer(LUNDI);
    expect(m).toHaveBeenCalledTimes(1);
    expect(m.mock.calls[0][1]).toContain("Plafond de licences dépassé");
  });

  it("un logiciel sain ou abandonné n'alerte pas", async () => {
    await prisma.software.createMany({
      data: [
        { name: "OK", lifecycle: "production", usersCount: 10, usersMax: 50 },
        { name: "Sans plafond", usersCount: 999 },
        { name: "Abandonné", lifecycle: "abandonne" },
        { name: "Corbeille", lifecycle: "fin_de_vie", isActive: false },
      ],
    });
    expect((await lancer(LUNDI)).mock.calls).toHaveLength(0);
  });

  it("l'interrupteur coupe les alertes", async () => {
    await prisma.software.create({ data: { name: "Ciril", lifecycle: "fin_de_vie" } });
    await regler({ SOFTWARE_ALERTS: false });
    expect((await lancer(LUNDI)).mock.calls).toHaveLength(0);
  });

  it("le report est respecté", async () => {
    const sw = await prisma.software.create({ data: { name: "Ciril", lifecycle: "fin_de_vie" } });
    await setSnooze("software", sw.id, 30);
    expect((await lancer(LUNDI)).mock.calls).toHaveLength(0);
  });
});

describe("préférences", () => {
  it("l'interrupteur se règle depuis les préférences", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/preferences")).text;
    expect(html).toContain('name="software_alerts"');
    expect(html).toContain("Alertes logiciels activées");
    await c.post("/preferences", { action: "save_software_alerts" }, { followRedirects: true });
    expect(await reglage("SOFTWARE_ALERTS")).toBe(false);
    await c.post(
      "/preferences",
      { action: "save_software_alerts", software_alerts: "on" },
      { followRedirects: true },
    );
    expect(await reglage("SOFTWARE_ALERTS")).toBe(true);
  });

  it("les logiciels ont leur liste de destinataires", async () => {
    const c = await clientAdmin();
    expect(ALERT_CATEGORIES).toContain("software");
    expect(ALERT_CATEGORY_LABELS.software).toBe("Logiciels");
    expect((await c.get("/preferences")).text).toContain('name="alert_recipients_software"');
    await regler({
      ALERT_RECIPIENTS: ["dsi@mairie.fr"],
      ALERT_RECIPIENTS_SOFTWARE: ["applis@mairie.fr"],
    });
    expect(alertRecipientsFor(await getSettings(), "software")).toEqual(["applis@mairie.fr"]);
  });
});

describe("report depuis la fiche, avec le droit de l'inventaire", () => {
  it("la catégorie de droits d'une alerte", () => {
    expect(permissionCategory("software")).toBe("software");
    expect(permissionCategory("equipment")).toBe("inventory");
    expect(permissionCategory("account")).toBe("accounts");
  });

  it("le report d'une alerte logiciel demande le droit logiciels", async () => {
    const sw = await prisma.software.create({ data: { name: "Ciril", lifecycle: "fin_de_vie" } });
    await creerUtilisateur("gest", "Gest-2026!", "gestionnaire", { software: 2 });
    const c = new ClientTest();
    await c.login("gest", "Gest-2026!");
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).toContain("Reporter…");
    const r = await c.post("/alerts/snooze", {
      entity_type: "software",
      entity_id: String(sw.id),
      days: "7",
    });
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.status).toBeLessThan(400);
    expect(r.location ?? "").toMatch(new RegExp(`/inventory/logiciels/${sw.id}$`));
    expect(await isSnoozed("software", sw.id)).toBe(true);
  });

  it("sans droit d'écriture, pas de report", async () => {
    const sw = await prisma.software.create({ data: { name: "Ciril" } });
    await creerUtilisateur("gest", "Gest-2026!", "gestionnaire", { software: 1 });
    const c = new ClientTest();
    await c.login("gest", "Gest-2026!");
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).not.toContain("Reporter…");
    await c.post("/alerts/snooze", {
      entity_type: "software",
      entity_id: String(sw.id),
      days: "7",
    });
    expect(await isSnoozed("software", sw.id)).toBe(false);
  });
});
