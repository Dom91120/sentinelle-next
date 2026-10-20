import { aujourdhui } from "@/lib/libelles";
import { recordBackupCheck } from "@/server/backups";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /backups/daily : les checks du jour, en une saisie. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("backups");
    const today = aujourdhui();
    const backups = await prisma.backup.findMany({ where: { isActive: true }, orderBy: { serviceName: "asc" } });
    for (const b of backups) {
      const status = form.get(`status_${b.id}`);
      const comment = form.get(`comment_${b.id}`);
      if (typeof status === "string" && status) await recordBackupCheck(b.id, today, status, typeof comment === "string" ? comment : "", user.username);
    }
    invalidateNavCounts();
    return redirigerAvecMessage("/backups/daily", "Checks quotidiens enregistres", "success");
  });
}
