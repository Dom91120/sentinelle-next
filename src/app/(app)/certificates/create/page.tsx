import { EnteteForm } from "@/components/formulaire";
import { formContext, kindDe } from "@/modules/certificates/server";
import { FormCorps } from "@/modules/certificates/vues";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Ajouter un certificat - Sentinelle" };

/** certificates/form.html (création) */
export default async function CertificateCreate({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const page = await contexteModule("certificates");
  await requireEdit("certificates");
  const kind = kindDe((await searchParams).kind);
  const ctx = await formContext();
  return (
    <>
      <EnteteForm titre="Ajouter un certificat" retour="/certificates" />
      <FormCorps certificate={null} kind={kind} {...ctx} user={page.user} csrf={page.csrf} nonce={page.nonce} retour="/certificates" />
    </>
  );
}
