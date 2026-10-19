import { notFound } from "next/navigation";
import { EnteteForm } from "@/components/formulaire";
import { formContext } from "@/modules/certificates/server";
import { FormCorps } from "@/modules/certificates/vues";
import { prisma } from "@/server/db";
import { idDeRoute, requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Modifier un certificat - Sentinelle" };

/** certificates/form.html (modification) */
export default async function CertificateEdit({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("certificates");
  await requireEdit("certificates");
  const id = idDeRoute((await params).id);
  const cert = await prisma.certificate.findUnique({ where: { id } });
  if (!cert) notFound();
  const ctx = await formContext();
  const retour = `/certificates/${id}`;
  return (
    <>
      <EnteteForm titre="Modifier un certificat" retour={retour} />
      <FormCorps certificate={cert} kind={cert.kind || "tls"} {...ctx} user={page.user} csrf={page.csrf} nonce={page.nonce} retour={retour} />
    </>
  );
}
