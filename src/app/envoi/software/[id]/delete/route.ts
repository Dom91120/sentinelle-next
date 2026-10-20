import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /software/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("software");
    const item = await prisma.software.findUnique({ where: { id } });
    if (!item) return pasTrouve();
    await prisma.software.update({ where: { id }, data: { isActive: false } });
    await auditRecord("suppression logiciel", item.name, "inventory", user.username);
    invalidateNavCounts();
    return redirigerAvecMessage("/software", "Logiciel supprimé", "success");
  });
}
