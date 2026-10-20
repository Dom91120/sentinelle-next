import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /domains/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("domains");
    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) return pasTrouve();
    await prisma.domain.update({ where: { id }, data: { isActive: false } });
    await prisma.domainHistory.create({ data: { domainId: id, action: "deleted", comment: `Domaine desactive : ${domain.name}`, performedBy: user.username } });
    invalidateNavCounts();
    return redirigerAvecMessage("/domains", "Domaine supprime", "success");
  });
}
