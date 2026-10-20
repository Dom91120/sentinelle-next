import { EnteteForm } from "@/components/formulaire";
import { parseInt_ } from "@/lib/forms-util";
import { FormulaireContrat } from "@/modules/contracts/form-page";
import { formContext } from "@/modules/contracts/server";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un contrat - Sentinelle" };

/** contracts/form.html (création ; ?software_id= coche ce logiciel dans les éléments couverts) */
export default async function ContractCreate({ searchParams }: { searchParams: Promise<{ software_id?: string }> }) {
  const page = await contexteModule("contracts");
  await requireEdit("contracts");
  const sid = parseInt_((await searchParams).software_id, null);
  const ctx = await formContext(sid ? [sid] : []);
  return (
    <>
      <EnteteForm titre="Ajouter un contrat" retour="/contracts" />
      <FormulaireContrat contract={null} ctx={ctx} couverts={{ software: [], equipment: [] }} page={page} retour="/contracts" />
    </>
  );
}
