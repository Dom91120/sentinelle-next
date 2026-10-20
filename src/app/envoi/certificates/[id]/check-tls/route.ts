import { refreshCertificateTls } from "@/modules/certificates/server";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /certificates/<id>/check-tls */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    await requireFeature("certificates");
    const user = await requireEdit("certificates");
    const cert = await prisma.certificate.findUnique({ where: { id } });
    if (!cert) return pasTrouve();
    const [ok, message] = await refreshCertificateTls(cert, user.username);
    invalidateNavCounts();
    return redirigerAvecMessage(`/certificates/${id}`, message, ok ? "success" : "danger");
  });
}
