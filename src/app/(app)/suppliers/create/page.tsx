import { EnteteForm } from "@/components/formulaire";
import { FormulaireFournisseur } from "@/modules/suppliers/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un fournisseur - Sentinelle" };

/** suppliers/form.html (création) */
export default async function SupplierCreate() {
  const page = await contexteModule("suppliers");
  await requireEdit("suppliers");
  return (
    <>
      <EnteteForm titre="Ajouter un fournisseur" retour="/suppliers" />
      <FormulaireFournisseur
        supplier={null}
        user={page.user}
        csrf={page.csrf}
        retour="/suppliers"
      />
    </>
  );
}
