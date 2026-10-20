import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /inventory/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("inventory");
    const item = await prisma.equipment.findUnique({ where: { id } });
    if (!item) return pasTrouve();
    await prisma.equipment.update({ where: { id }, data: { isActive: false } });
    await auditRecord("suppression inventaire", item.name, "inventory", user.username);
    invalidateNavCounts();
    return redirigerAvecMessage("/inventory", "Équipement supprimé", "success");
  });
}
