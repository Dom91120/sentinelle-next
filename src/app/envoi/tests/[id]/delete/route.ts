import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /tests/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("tests");
    const test = await prisma.testTask.findUnique({ where: { id } });
    if (!test) return pasTrouve();
    await prisma.testTask.update({ where: { id }, data: { isActive: false } });
    await prisma.testHistory.create({
      data: {
        testId: id,
        action: "deleted",
        comment: `Test désactivé : ${test.name}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/tests", "Test supprimé", "success");
  });
}
