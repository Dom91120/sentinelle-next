import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/domains/server";
import { FormCorps } from "@/modules/domains/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un domaine - Sentinelle" };

/** domains/form.html (création) */
export default async function DomainCreate() {
  const page = await contexteModule("domains");
  await requireEdit("domains");
  const ctx = await formContext();
  return (
    <>
      <EnteteForm titre="Ajouter un domaine" retour="/domains" />
      <FormCorps
        domain={null}
        {...ctx}
        user={page.user}
        csrf={page.csrf}
        nonce={page.nonce}
        retour="/domains"
      />
    </>
  );
}
