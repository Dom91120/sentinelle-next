import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/inventory/server";
import { FormCorps } from "@/modules/inventory/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un équipement - Sentinelle" };

/** inventory/form.html (modification) */
export default async function InventoryEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("inventory");
  await requireEdit("inventory");
  const id = idDeRoute((await params).id);
  const item = await prisma.equipment.findUnique({ where: { id } });
  if (!item) notFound();
  const ctx = await formContext(item);
  const retour = `/inventory/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier un équipement" retour={retour} />
      <FormCorps item={item} {...ctx} user={page.user} csrf={page.csrf} nonce={page.nonce} retour={retour} />
    </>
  );
}
