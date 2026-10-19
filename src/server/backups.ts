/** Pointage d'une sauvegarde (port de record_backup_check dans app/backups.py). */
import { dateCourte } from "@/lib/libelles";
import { prisma } from "@/server/db";

export const BACKUP_STATUS_LABELS: Record<string, string> = { ok: "OK", warning: "Warning", failed: "Échec" };

/**
 * Crée ou met à jour le check d'un jour et trace l'action dans l'historique.
 * Le premier état du jour (first_status) est figé à la création.
 */
export async function recordBackupCheck(
  backupId: number,
  checkDate: Date,
  statusIn: string,
  comment: string,
  user: string,
): Promise<void> {
  const status = statusIn in BACKUP_STATUS_LABELS ? statusIn : "ok";
  const label = BACKUP_STATUS_LABELS[status] ?? status;
  const existing = await prisma.backupCheck.findUnique({ where: { backupId_checkDate: { backupId, checkDate } } });
  let note: string;
  if (existing) {
    const old = existing.status;
    await prisma.backupCheck.update({
      where: { id: existing.id },
      data: {
        status,
        comment: comment ? comment : existing.comment,
        checkedBy: user,
        firstStatus: existing.firstStatus ?? old,
      },
    });
    note =
      old !== status
        ? `Statut du ${dateCourte(checkDate)} modifié : ${BACKUP_STATUS_LABELS[old] ?? old} → ${label}`
        : `Re-validation du ${dateCourte(checkDate)} : ${label}`;
  } else {
    await prisma.backupCheck.create({
      data: { backupId, checkDate, status, firstStatus: status, comment: comment || null, checkedBy: user },
    });
    note = `Check du ${dateCourte(checkDate)} : ${label}`;
  }
  if (comment) note += ` — ${comment}`;
  await prisma.backupHistory.create({
    data: { backupId, action: "check", status, comment: note, performedBy: user },
  });
}
