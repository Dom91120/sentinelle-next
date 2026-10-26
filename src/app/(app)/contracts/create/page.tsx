import { EnteteForm } from "@/components/formulaire";
import { parseInt_ } from "@/lib/forms-util";
import { FormulaireContrat } from "@/modules/contracts/form-page";
import { formContext } from "@/modules/contracts/server";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un contrat - Sentinelle" };

/**
 * contracts/form.html (création ; ?software_id= coche ce logiciel dans les éléments couverts,
 * ?supplier_id= présélectionne ce fournisseur et ramène à sa fiche).
 */
export default async function ContractCreate({
  searchParams,
}: {
  searchParams: Promise<{ software_id?: string; supplier_id?: string }>;
}) {
  const page = await contexteModule("contracts");
  await requireEdit("contracts");
  const p = await searchParams;
  const sid = parseInt_(p.software_id, null);
  const fid = parseInt_(p.supplier_id, null);
  const ctx = await formContext(sid ? [sid] : []);
  const retour = fid ? `/suppliers/${fid}#contrats` : "/contracts";
  return (
    <>
      <EnteteForm titre="Ajouter un contrat" retour={retour} />
      <FormulaireContrat
        contract={null}
        ctx={ctx}
        couverts={{ software: [], equipment: [] }}
        page={page}
        retour={retour}
        fournisseurChoisi={fid}
      />
    </>
  );
}
