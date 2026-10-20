import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/updates/server";
import { FormCorps } from "@/modules/updates/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier une mise à jour - Sentinelle" };

/** updates/form.html (modification) */
export default async function UpdateEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("updates");
  await requireEdit("updates");
  const id = idDeRoute((await params).id);
  const update = await prisma.systemUpdate.findUnique({ where: { id } });
  if (!update) notFound();
  const ctx = await formContext();
  const retour = `/updates/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier — Mises à jour" retour={retour} />
      <FormCorps update={update} {...ctx} user={page.user} csrf={page.csrf} nonce={page.nonce} retour={retour} />
    </>
  );
}
