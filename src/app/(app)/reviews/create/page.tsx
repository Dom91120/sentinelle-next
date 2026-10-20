import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/reviews/server";
import { FormCorps } from "@/modules/reviews/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter une revue - Sentinelle" };

/** reviews/form.html (création) */
export default async function ReviewCreate() {
  const page = await contexteModule("reviews");
  await requireEdit("reviews");
  const ctx = await formContext();
  return (
    <>
      <EnteteForm titre="Ajouter une revue de droits" retour="/reviews" />
      <FormCorps review={null} {...ctx} user={page.user} csrf={page.csrf} retour="/reviews" />
    </>
  );
}
