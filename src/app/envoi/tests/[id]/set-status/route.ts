import { VALID_STATUS } from "@/modules/tests/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, referer, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /tests/<id>/set-status (Kanban) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("tests");
    const test = await prisma.testTask.findUnique({ where: { id } });
    if (!test) return pasTrouve();
    const demande = form.get("status");
    const status = typeof demande === "string" && VALID_STATUS.has(demande) ? demande : "pending";
    await prisma.testTask.update({ where: { id }, data: { status } });
    await prisma.testHistory.create({
      data: {
        testId: id,
        action: "status_change",
        comment: `Statut changé en ${status} (Kanban)`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage(
      referer(req, "/tests/kanban"),
      `Statut mis à jour : ${status}`,
      "success",
    );
  });
}
