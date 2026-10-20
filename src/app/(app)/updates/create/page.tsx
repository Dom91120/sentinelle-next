import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/updates/server";
import { FormCorps } from "@/modules/updates/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter une mise à jour - Sentinelle" };

/** updates/form.html (création) */
export default async function UpdateCreate() {
  const page = await contexteModule("updates");
  await requireEdit("updates");
  const ctx = await formContext();
  return (
    <>
      <EnteteForm titre="Ajouter — Mises à jour" retour="/updates" />
      <FormCorps update={null} {...ctx} user={page.user} csrf={page.csrf} nonce={page.nonce} retour="/updates" />
    </>
  );
}
