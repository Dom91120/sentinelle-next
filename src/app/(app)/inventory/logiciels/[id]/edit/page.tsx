import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { FormulaireLogiciel, rattachementsDe } from "@/modules/software/form-page";
import { formContext } from "@/modules/software/server";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un logiciel - Sentinelle" };

/** software/form.html (modification) */
export default async function SoftwareEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("software");
  await requireEdit("software");
  const id = idDeRoute((await params).id);
  const item = await prisma.software.findUnique({ where: { id } });
  if (!item) notFound();
  const ctx = await formContext();
  const retour = `/inventory/logiciels/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier le logiciel" retour={retour} />
      <FormulaireLogiciel
        item={item}
        ctx={ctx}
        page={page}
        retour={retour}
        rattachements={await rattachementsDe(prisma, id)}
      />
    </>
  );
}
