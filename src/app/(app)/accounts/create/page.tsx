import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/accounts/server";
import { FormCorps } from "@/modules/accounts/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un compte - Sentinelle" };

/** accounts/form.html (création) */
export default async function AccountCreate() {
  const page = await contexteModule("accounts");
  await requireEdit("accounts");
  const ctx = await formContext();
  return (
    <>
      <EnteteForm titre="Ajouter un compte" retour="/accounts" />
      <FormCorps account={null} {...ctx} user={page.user} csrf={page.csrf} retour="/accounts" />
    </>
  );
}
