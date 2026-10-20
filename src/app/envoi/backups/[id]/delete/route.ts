import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /backups/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("backups");
    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) return pasTrouve();
    await prisma.backup.update({ where: { id }, data: { isActive: false } });
    await prisma.backupHistory.create({
      data: {
        backupId: id,
        action: "deleted",
        comment: `Backup desactive : ${backup.serviceName}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/backups", "Backup supprime", "success");
  });
}
