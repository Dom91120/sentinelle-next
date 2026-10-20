import { applicationDe, depuisFormulaire } from "@/modules/reviews/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /reviews/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    await requireEdit("reviews");
    const review = await prisma.accessReview.findUnique({ where: { id } });
    if (!review) return pasTrouve();
    const application = applicationDe(form);
    if (!application) return redirigerAvecMessage(`/reviews/${id}/edit`, "L'application est obligatoire.", "danger");
    await prisma.accessReview.update({ where: { id }, data: await depuisFormulaire(form, application) });
    invalidateNavCounts();
    return redirigerAvecMessage(`/reviews/${id}`, "Revue modifiee", "success");
  });
}
