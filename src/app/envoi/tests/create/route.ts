import { champ } from "@/lib/forms-util";
import { ajouterJours, depuisFormulaire } from "@/modules/tests/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /tests/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("tests");
    const name = champ(form, "name");
    if (!name)
      return redirigerAvecMessage("/tests/create", "Le nom du test est obligatoire.", "danger");
    const data = depuisFormulaire(form);
    if (!data.nextDue && data.lastPerformed)
      data.nextDue = ajouterJours(data.lastPerformed, data.frequencyDays);
    const t = await prisma.testTask.create({ data: { name, ...data, status: "pending" } });
    await prisma.testHistory.create({
      data: {
        testId: t.id,
        action: "creation",
        comment: `Test créé : ${t.name}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/tests", "Test ajouté avec succès", "success");
  });
}
