import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/backups/server";
import { FormCorps } from "@/modules/backups/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un backup - Sentinelle" };

/** backups/form.html (création) */
export default async function BackupCreate() {
  const page = await contexteModule("backups");
  await requireEdit("backups");
  const ctx = await formContext();
  return (
    <>
      <EnteteForm titre="Ajouter un backup" retour="/backups" />
      <FormCorps backup={null} {...ctx} user={page.user} csrf={page.csrf} retour="/backups" />
    </>
  );
}
