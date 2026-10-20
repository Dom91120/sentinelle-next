import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { FormulaireContrat } from "@/modules/contracts/form-page";
import { couvertsDe, formContext } from "@/modules/contracts/server";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un contrat - Sentinelle" };

/** contracts/form.html (modification) */
export default async function ContractEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("contracts");
  await requireEdit("contracts");
  const id = idDeRoute((await params).id);
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) notFound();
  const [ctx, couverts] = await Promise.all([formContext(), couvertsDe(id)]);
  const retour = `/contracts/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier le contrat" retour={retour} />
      <FormulaireContrat contract={contract} ctx={ctx} couverts={couverts} page={page} retour={retour} />
    </>
  );
}
