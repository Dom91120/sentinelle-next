import { aujourdhui } from "@/lib/libelles";
import { recordBackupCheck } from "@/server/backups";
import { requireUser } from "@/server/guards";
import { idDe, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /quick-check (dashboard.quick_check) */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireUser();
    if (!user.canEdit("backups"))
      return redirigerAvecMessage(
        "/",
        "Vous n'avez pas les droits pour valider un backup.",
        "danger",
      );
    const backupId = idDe(String(form.get("backup_id") ?? ""));
    if (!backupId) return redirigerAvecMessage("/", "Backup introuvable.", "danger");
    await recordBackupCheck(
      backupId,
      aujourdhui(),
      String(form.get("status") ?? "ok"),
      String(form.get("comment") ?? ""),
      user.username,
    );
    invalidateNavCounts();
    return redirigerAvecMessage("/", "Backup valide", "success");
  });
}
