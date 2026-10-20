import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /certificates/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("certificates");
    const cert = await prisma.certificate.findUnique({ where: { id } });
    if (!cert) return pasTrouve();
    await prisma.certificate.update({ where: { id }, data: { isActive: false } });
    await prisma.certificateHistory.create({
      data: {
        certificateId: id,
        action: "deleted",
        comment: `Certificat désactivé : ${cert.serviceName} - ${cert.domain ?? "None"}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/certificates", "Certificat supprimé", "success");
  });
}
