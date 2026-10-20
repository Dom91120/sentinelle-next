import { ajouterJours, applicationDe, depuisFormulaire } from "@/modules/reviews/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /reviews/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("reviews");
    const application = applicationDe(form);
    if (!application)
      return redirigerAvecMessage("/reviews/create", "L'application est obligatoire.", "danger");
    const data = await depuisFormulaire(form, application);
    if (!data.nextReview && data.lastReview)
      data.nextReview = ajouterJours(data.lastReview, data.frequencyDays);
    const r = await prisma.accessReview.create({ data: { ...data, status: "pending" } });
    await prisma.reviewHistory.create({
      data: {
        reviewId: r.id,
        action: "creation",
        comment: `Revue creee : ${r.application}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/reviews", "Revue de droits ajoutee", "success");
  });
}
