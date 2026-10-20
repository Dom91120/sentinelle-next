import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/domains/server";
import { FormCorps } from "@/modules/domains/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un domaine - Sentinelle" };

/** domains/form.html (modification) */
export default async function DomainEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("domains");
  await requireEdit("domains");
  const id = idDeRoute((await params).id);
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) notFound();
  const ctx = await formContext();
  const retour = `/domains/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier un domaine" retour={retour} />
      <FormCorps
        domain={domain}
        {...ctx}
        user={page.user}
        csrf={page.csrf}
        nonce={page.nonce}
        retour={retour}
      />
    </>
  );
}
