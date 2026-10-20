import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/backups/server";
import { FormCorps } from "@/modules/backups/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un backup - Sentinelle" };

/** backups/form.html (modification) */
export default async function BackupEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("backups");
  await requireEdit("backups");
  const id = idDeRoute((await params).id);
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) notFound();
  const ctx = await formContext();
  const retour = `/backups/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier un backup" retour={retour} />
      <FormCorps backup={backup} {...ctx} user={page.user} csrf={page.csrf} retour={retour} />
    </>
  );
}
