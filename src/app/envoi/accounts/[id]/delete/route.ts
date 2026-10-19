import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /accounts/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("accounts");
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) return pasTrouve();
    await prisma.account.update({ where: { id }, data: { isActive: false } });
    await prisma.accountHistory.create({
      data: { accountId: id, action: "deleted", comment: `Compte désactivé : ${account.serviceName} (${account.username})`, performedBy: user.username },
    });
    invalidateNavCounts();
    return redirigerAvecMessage("/accounts", "Compte supprimé", "success");
  });
}
