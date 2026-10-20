import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { FormulaireFournisseur } from "@/modules/suppliers/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un fournisseur - Sentinelle" };

/** suppliers/form.html (modification) */
export default async function SupplierEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("suppliers");
  await requireEdit("suppliers");
  const id = idDeRoute((await params).id);
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();
  const retour = `/suppliers/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier le fournisseur" retour={retour} />
      <FormulaireFournisseur supplier={supplier} user={page.user} csrf={page.csrf} retour={retour} />
    </>
  );
}
