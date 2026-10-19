/** Gestion des reports d'alerte (port de app/snooze.py). */
import { aujourdhui } from "@/lib/libelles";
import { prisma } from "@/server/db";

export { permissionCategory, SNOOZE_VALID_TYPES } from "@/lib/constantes";

/** Retourne le report actif (snoozed_until ≥ aujourd'hui) ou null. */
export async function getActiveSnooze(entityType: string, entityId: number) {
  return prisma.alertSnooze.findFirst({
    where: { entityType, entityId, snoozedUntil: { gte: aujourdhui() } },
  });
}

export async function isSnoozed(entityType: string, entityId: number): Promise<boolean> {
  return (await getActiveSnooze(entityType, entityId)) !== null;
}

/** Ensemble des « type:id » ayant un report actif aujourd'hui, chargé en UNE requête. */
export async function activeSnoozeKeys(): Promise<Set<string>> {
  const rows = await prisma.alertSnooze.findMany({
    where: { snoozedUntil: { gte: aujourdhui() } },
    select: { entityType: true, entityId: true },
  });
  return new Set(rows.map((r) => `${r.entityType}:${r.entityId}`));
}

export function snoozeKey(entityType: string, entityId: number): string {
  return `${entityType}:${entityId}`;
}

/** Crée ou met à jour le report pour `days` jours (à partir d'aujourd'hui). Retourne la date. */
export async function setSnooze(
  entityType: string,
  entityId: number,
  days: number,
  reason: string | null = null,
  createdBy: string | null = null,
): Promise<Date> {
  const until = aujourdhui();
  until.setUTCDate(until.getUTCDate() + Math.trunc(days));
  await prisma.alertSnooze.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    update: { snoozedUntil: until, reason, createdBy, createdAt: new Date() },
    create: { entityType, entityId, snoozedUntil: until, reason, createdBy },
  });
  return until;
}

export async function clearSnooze(entityType: string, entityId: number): Promise<void> {
  await prisma.alertSnooze.deleteMany({ where: { entityType, entityId } });
}
