import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /domains/<id>/ct-ack : marque tous les certificats CT « new » comme vérifiés. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("domains");
    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) return pasTrouve();
    const { count: n } = await prisma.ctLogEntry.updateMany({
      where: { domainId: id, status: "new" },
      data: { status: "acknowledged", acknowledgedBy: user.username, acknowledgedAt: new Date() },
    });
    if (n) {
      await prisma.domainHistory.create({
        data: {
          domainId: id,
          action: "ct_acknowledged",
          comment: `${n} certificat(s) CT marque(s) comme verifie(s).`,
          performedBy: user.username,
        },
      });
    }
    return redirigerAvecMessage(
      `/domains/${id}`,
      `${n} certificat(s) marque(s) comme verifie(s).`,
      "success",
    );
  });
}
