import { aujourdhui } from "@/lib/libelles";
import { ajouterJours } from "@/modules/tests/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /tests/<id>/complete */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("tests");
    const test = await prisma.testTask.findUnique({ where: { id } });
    if (!test) return pasTrouve();
    const texte = (k: string, defaut = "") =>
      typeof form.get(k) === "string" ? (form.get(k) as string) : defaut;
    const result = texte("result");
    const comment = texte("comment");
    const outcome = texte("outcome", "success");
    const today = aujourdhui();
    await prisma.testTask.update({
      where: { id },
      data: {
        lastPerformed: today,
        nextDue: ajouterJours(today, test.frequencyDays ?? 90),
        status: outcome,
        result,
      },
    });
    await prisma.testHistory.create({
      data: { testId: id, action: "completed", result, comment, performedBy: user.username },
    });
    invalidateNavCounts();
    return redirigerAvecMessage(`/tests/${id}`, "Test marqué comme effectué", "success");
  });
}
