import { EnteteForm } from "@/components/formulaire";
import { FormulaireLogiciel, rattachementsDe } from "@/modules/software/form-page";
import { formContext } from "@/modules/software/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un logiciel - Sentinelle" };

/** software/form.html (création) */
export default async function SoftwareCreate() {
  const page = await contexteModule("software");
  await requireEdit("software");
  const ctx = await formContext();
  return (
    <>
      <EnteteForm titre="Ajouter un logiciel" retour="/inventory/logiciels" />
      <FormulaireLogiciel
        item={null}
        ctx={ctx}
        page={page}
        retour="/inventory/logiciels"
        rattachements={await rattachementsDe(prisma, null)}
      />
    </>
  );
}
