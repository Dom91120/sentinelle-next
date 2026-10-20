import { parseDate } from "@/lib/forms-util";
import { aujourdhui } from "@/lib/libelles";
import { recordBackupCheck } from "@/server/backups";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /backups/<id>/check */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("backups");
    if (!(await prisma.backup.findUnique({ where: { id }, select: { id: true } }))) return pasTrouve();
    const status = typeof form.get("status") === "string" ? (form.get("status") as string) : "ok";
    const comment = typeof form.get("comment") === "string" ? (form.get("comment") as string) : "";
    const checkDate = parseDate(form.get("check_date")) ?? aujourdhui();
    await recordBackupCheck(id, checkDate, status, comment, user.username);
    invalidateNavCounts();
    return redirigerAvecMessage(`/backups/${id}`, "Check enregistre", "success");
  });
}
