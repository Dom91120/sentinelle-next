import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /updates/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("updates");
    const update = await prisma.systemUpdate.findUnique({ where: { id } });
    if (!update) return pasTrouve();
    await prisma.systemUpdate.update({ where: { id }, data: { isActive: false } });
    await prisma.updateHistory.create({
      data: {
        updateId: id,
        action: "deleted",
        comment: `Mise à jour désactivée : ${update.name}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/updates", "Entree supprimee", "success");
  });
}
