import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/tests/server";
import { FormCorps } from "@/modules/tests/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un test - Sentinelle" };

/** tests/form.html (modification) */
export default async function TestEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("tests");
  await requireEdit("tests");
  const id = idDeRoute((await params).id);
  const test = await prisma.testTask.findUnique({ where: { id } });
  if (!test) notFound();
  const ctx = await formContext();
  const retour = `/tests/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier un test" retour={retour} />
      <FormCorps test={test} {...ctx} user={page.user} csrf={page.csrf} retour={retour} />
    </>
  );
}
