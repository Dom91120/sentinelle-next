/** Politique de rappel des alertes (base), reports (snooze) et interrupteur des mails (port de tests/test_alertes.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { sendAlert, shouldSendReminder } from "@/server/alerts";
import { getSettings } from "@/server/config-store";
import { MailDisabled, sendEmail } from "@/server/mailer";
import { clearSnooze, isSnoozed, setSnooze } from "@/server/snooze";
import { clientAdmin } from "./setup/client";
import { prisma, reglage, regler, resetDb } from "./setup/db";

const TH: [number, number, number] = [7, 15, 30];

beforeEach(resetDb);

async function log(daysAgo: number, status = "sent") {
  await prisma.alertLog.create({
    data: {
      alertType: "email",
      entityType: "certificate",
      entityId: 42,
      sentAt: new Date(Date.now() - daysAgo * 86_400_000),
      status,
    },
  });
}

describe("should_send_reminder (base)", () => {
  it("hors fenêtre : pas d'alerte", async () => {
    expect(await shouldSendReminder("certificate", 42, 45, TH)).toBe(false);
  });
  it("première alerte dans la fenêtre", async () => {
    expect(await shouldSendReminder("certificate", 42, 20, TH)).toBe(true);
  });
  it("cadence warning : 7 jours", async () => {
    await log(1);
    expect(await shouldSendReminder("certificate", 42, 20, TH)).toBe(false);
    await prisma.alertLog.deleteMany();
    await log(8);
    expect(await shouldSendReminder("certificate", 42, 20, TH)).toBe(true);
  });
  it("cadence danger : 2 jours", async () => {
    await log(1);
    expect(await shouldSendReminder("certificate", 42, 5, TH)).toBe(false);
    await prisma.alertLog.deleteMany();
    await log(2);
    expect(await shouldSendReminder("certificate", 42, 5, TH)).toBe(true);
  });
  it("échu : rappel quotidien", async () => {
    await log(1);
    expect(await shouldSendReminder("certificate", 42, -3, TH)).toBe(true);
  });
  it("un envoi échoué ne bloque pas", async () => {
    await log(0, "failed");
    expect(await shouldSendReminder("certificate", 42, 20, TH)).toBe(true);
  });
  it("l'alerte d'une autre entité est sans effet", async () => {
    await log(0);
    expect(await shouldSendReminder("certificate", 43, 20, TH)).toBe(true);
  });
  it("seuils invalides : pas d'alerte", async () => {
    expect(await shouldSendReminder("certificate", 42, 5, null)).toBe(false);
    expect(
      await shouldSendReminder("certificate", 42, 5, [7, 15] as unknown as [
        number,
        number,
        number,
      ]),
    ).toBe(false);
  });
});

describe("reports", () => {
  it("snooze", async () => {
    expect(await isSnoozed("certificate", 42)).toBe(false);
    await setSnooze("certificate", 42, 7, "renouvellement en cours");
    expect(await isSnoozed("certificate", 42)).toBe(true);
    await clearSnooze("certificate", 42);
    expect(await isSnoozed("certificate", 42)).toBe(false);
  });
  it("snooze expiré", async () => {
    await setSnooze("certificate", 42, -1);
    expect(await isSnoozed("certificate", 42)).toBe(false);
  });
});

describe("interrupteur général de l'envoi des mails", () => {
  it("coupé : aucun envoi, l'alerte se journalise en échec, les webhooks partent", async () => {
    await regler({ MAIL_ENABLED: false, ALERT_RECIPIENTS: ["dsi@exemple.fr"] });
    const cfg = await getSettings();
    await expect(sendEmail("s", ["a@b.fr"], "corps", null, undefined, cfg)).rejects.toBeInstanceOf(
      MailDisabled,
    );
    const webhooks: unknown[] = [];
    await sendAlert("Objet", "Corps", "certificate", 7, "c", "danger", {
      cfg,
      notifyAll: async (...a) => {
        webhooks.push(a);
        return 0;
      },
    });
    const logs = await prisma.alertLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("failed");
    expect(logs[0].message ?? "").toContain("désactivé");
    expect(webhooks).toHaveLength(1);
  });

  it("se règle dans les préférences", async () => {
    const c = await clientAdmin();
    await c.post("/preferences", { action: "save_mail_enabled" });
    expect(await reglage("MAIL_ENABLED")).toBe(false);
    await c.post("/preferences", { action: "save_mail_enabled", mail_enabled: "on" });
    expect(await reglage("MAIL_ENABLED")).toBe(true);
    expect((await c.get("/preferences")).text).toContain('id="mailEnabled"');
  });
});
