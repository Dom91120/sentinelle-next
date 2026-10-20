import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /contracts/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("contracts");
    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) return pasTrouve();
    await prisma.contract.update({ where: { id }, data: { isActive: false } });
    await prisma.contractHistory.create({
      data: {
        contractId: id,
        action: "deleted",
        comment: `Contrat désactivé : ${contract.name}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/contracts", "Contrat supprimé", "success");
  });
}
