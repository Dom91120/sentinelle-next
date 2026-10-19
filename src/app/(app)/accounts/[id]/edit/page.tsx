import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/accounts/server";
import { FormCorps } from "@/modules/accounts/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un compte - Sentinelle" };

/** accounts/form.html (modification) */
export default async function AccountEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("accounts");
  await requireEdit("accounts");
  const id = idDeRoute((await params).id);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) notFound();
  const ctx = await formContext();
  const retour = `/accounts/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier un compte" retour={retour} />
      <FormCorps account={account} {...ctx} user={page.user} csrf={page.csrf} retour={retour} />
    </>
  );
}
