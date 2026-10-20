import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /reviews/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("reviews");
    const review = await prisma.accessReview.findUnique({ where: { id } });
    if (!review) return pasTrouve();
    await prisma.accessReview.update({ where: { id }, data: { isActive: false } });
    await prisma.reviewHistory.create({ data: { reviewId: id, action: "deleted", comment: `Revue desactivee : ${review.application}`, performedBy: user.username } });
    invalidateNavCounts();
    return redirigerAvecMessage("/reviews", "Revue supprimee", "success");
  });
}
