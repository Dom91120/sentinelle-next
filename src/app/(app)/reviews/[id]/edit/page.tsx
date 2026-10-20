import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/reviews/server";
import { FormCorps } from "@/modules/reviews/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier une revue - Sentinelle" };

/** reviews/form.html (modification) */
export default async function ReviewEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("reviews");
  await requireEdit("reviews");
  const id = idDeRoute((await params).id);
  const review = await prisma.accessReview.findUnique({ where: { id } });
  if (!review) notFound();
  const ctx = await formContext();
  const retour = `/reviews/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier une revue de droits" retour={retour} />
      <FormCorps review={review} {...ctx} user={page.user} csrf={page.csrf} retour={retour} />
    </>
  );
}
