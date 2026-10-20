/**
 * Politique d'alerte (port de app/alerts.py) : cadence de rappel avec
 * rattrapage, destinataires par catégorie, envoi anti-doublon journalisé.
 */
import { entityUrl, permissionCategory, type Triplet } from "@/lib/constantes";
import { aujourdhui, diffJours } from "@/lib/libelles";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { MailDisabled, renderAlertEmail, sendEmail } from "@/server/mailer";
import { notifyAll } from "@/server/notify";

/**
 * Faut-il (re)envoyer un rappel ? `thresholds` = (danger, warning, info) en jours restants :
 *  - au-delà du seuil info : pas d'alerte ;
 *  - zone info/warning : rappel tous les 7 jours ;
 *  - zone danger : rappel tous les 2 jours ;
 *  - échéance dépassée : rappel quotidien.
 * Logique pure : `lastSentAt` est la date de la dernière alerte réellement envoyée.
 */
export function reminderDue(
  daysLeft: number,
  thresholds: Triplet | null | undefined,
  lastSentAt: Date | null,
  today = aujourdhui(),
): boolean {
  if (thresholds?.length !== 3) return false;
  const [danger, , info] = thresholds;
  if (daysLeft > info) return false;
  let cadence: number;
  if (daysLeft < 0) cadence = 1;
  else if (daysLeft <= danger) cadence = 2;
  else cadence = 7;
  if (!lastSentAt) return true;
  return -diffJours(lastSentAt, today) >= cadence;
}

/** Version base : lit la dernière alerte envoyée pour cet élément. */
export async function shouldSendReminder(
  entityType: string,
  entityId: number,
  daysLeft: number,
  thresholds: Triplet | null | undefined,
): Promise<boolean> {
  if (thresholds?.length !== 3) return false;
  const [, , info] = thresholds;
  if (daysLeft > info) return false;
  const last = await prisma.alertLog.findFirst({
    where: { entityType, entityId, status: "sent" },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  return reminderDue(daysLeft, thresholds, last?.sentAt ?? null);
}

/** Destinataires d'une alerte : liste propre à la catégorie si définie, sinon la globale. */
export function alertRecipientsFor(cfg: AppSettings, entityType?: string | null): string[] {
  if (entityType) {
    const specific = (
      (cfg[`ALERT_RECIPIENTS_${entityType.toUpperCase()}`] as string[] | undefined) ?? []
    )
      .map((r) => r.trim())
      .filter(Boolean);
    if (specific.length) return specific;
  }
  return (cfg.ALERT_RECIPIENTS ?? []).map((r) => r.trim()).filter(Boolean);
}

export type SendAlertDeps = {
  cfg?: AppSettings;
  sendEmail?: typeof sendEmail;
  notifyAll?: typeof notifyAll;
};

/** Envoie une alerte (mail + webhooks), une seule par élément et par jour, et la journalise. */
export async function sendAlert(
  subject: string,
  body: string,
  entityType: string | null = null,
  entityId: number | null = null,
  entityName: string | null = null,
  status = "danger",
  deps: SendAlertDeps = {},
): Promise<boolean | undefined> {
  const cfg = deps.cfg ?? (await getSettings());
  const recipients = alertRecipientsFor(cfg, entityType);
  if (!recipients.length) return undefined;

  if (entityType && entityId) {
    const debut = aujourdhui();
    const fin = new Date(debut.getTime() + 86_400_000);
    const already = await prisma.alertLog.findFirst({
      where: { entityType, entityId, status: "sent", sentAt: { gte: debut, lt: fin } },
      select: { id: true },
    });
    if (already) return undefined;
  }

  const envoyer = deps.sendEmail ?? sendEmail;
  const notifier = deps.notifyAll ?? notifyAll;
  try {
    let url: string | null = null;
    if (entityType && entityId) {
      const base = (cfg.APP_BASE_URL || "").replace(/\/+$/, "");
      if (base) url = `${base}${entityUrl(entityType, entityId)}`;
    }
    const htmlBody = renderAlertEmail(subject, body, status, url);
    let mailCoupe: MailDisabled | null = null;
    try {
      await envoyer(subject, recipients, body, htmlBody, undefined, cfg);
    } catch (e) {
      if (e instanceof MailDisabled) mailCoupe = e;
      else throw e;
    }
    try {
      const category = entityType ? permissionCategory(entityType) : null;
      await notifier(cfg, subject, body, status, url, category);
    } catch {
      // best-effort
    }
    if (mailCoupe) throw mailCoupe;
    await prisma.alertLog.create({
      data: {
        alertType: "email",
        entityType,
        entityId,
        entityName,
        message: body,
        recipients: recipients.join(", "),
        status: "sent",
      },
    });
    return true;
  } catch (e) {
    await prisma.alertLog.create({
      data: {
        alertType: "email",
        entityType,
        entityId,
        entityName,
        message: `ERREUR: ${e instanceof Error ? e.message : String(e)}\n${body}`,
        recipients: recipients.join(", "),
        status: "failed",
      },
    });
    return false;
  }
}
