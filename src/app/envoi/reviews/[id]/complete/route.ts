import { aujourdhui } from "@/lib/libelles";
import { ajouterJours } from "@/modules/reviews/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /reviews/<id>/complete */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("reviews");
    const review = await prisma.accessReview.findUnique({ where: { id } });
    if (!review) return pasTrouve();
    const outcome =
      typeof form.get("outcome") === "string" ? (form.get("outcome") as string) : "completed";
    const comment = typeof form.get("comment") === "string" ? (form.get("comment") as string) : "";
    const today = aujourdhui();
    await prisma.accessReview.update({
      where: { id },
      data: {
        lastReview: today,
        nextReview: ajouterJours(today, review.frequencyDays || 365),
        status: outcome,
      },
    });
    await prisma.reviewHistory.create({
      data: {
        reviewId: id,
        action: "completed",
        comment: comment || "Revue effectuee",
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage(`/reviews/${id}`, "Revue marquee comme effectuee", "success");
  });
}
