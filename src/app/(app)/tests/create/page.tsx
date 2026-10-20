import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/tests/server";
import { FormCorps } from "@/modules/tests/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un test - Sentinelle" };

/** tests/form.html (création) */
export default async function TestCreate() {
  const page = await contexteModule("tests");
  await requireEdit("tests");
  const ctx = await formContext();
  return (
    <>
      <EnteteForm titre="Ajouter un test" retour="/tests" />
      <FormCorps test={null} {...ctx} user={page.user} csrf={page.csrf} retour="/tests" />
    </>
  );
}
