import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/inventory/server";
import { FormCorps } from "@/modules/inventory/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un équipement - Sentinelle" };

/** inventory/form.html (création) */
export default async function InventoryCreate({ searchParams }: { searchParams: Promise<{ famille?: string }> }) {
  const page = await contexteModule("inventory");
  await requireEdit("inventory");
  const ctx = await formContext(null, (await searchParams).famille);
  return (
    <>
      <EnteteForm titre="Ajouter un équipement" retour="/inventory" />
      <FormCorps item={null} {...ctx} user={page.user} csrf={page.csrf} nonce={page.nonce} retour="/inventory" />
    </>
  );
}
