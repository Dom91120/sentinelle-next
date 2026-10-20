import { scanInbox } from "@/modules/backups/server";
import { getSettings } from "@/server/config-store";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /backups/scan-inbox : lit les mails de sauvegarde déposés dans BACKUP_INBOX_DIR. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async () => {
    await requireEdit("backups");
    const directory = (await getSettings()).BACKUP_INBOX_DIR;
    if (!directory)
      return redirigerAvecMessage(
        "/backups",
        "Aucun repertoire de mails configure (BACKUP_INBOX_DIR).",
        "danger",
      );
    const summary = await scanInbox(directory);
    if (summary.error) return redirigerAvecMessage("/backups", summary.error, "danger");
    const nFiles = summary.files.length;
    const nUpdates = summary.files.reduce((a, f) => a + (f.updated?.length ?? 0), 0);
    invalidateNavCounts();
    return redirigerAvecMessage(
      "/backups",
      `${nFiles} fichier(s) traite(s), ${nUpdates} sauvegarde(s) mise(s) a jour.`,
      nFiles ? "success" : "info",
    );
  });
}
