import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /suppliers/<id>/delete (corbeille) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireDelete("suppliers");
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return pasTrouve();
    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    await auditRecord("suppression fournisseur", supplier.name, "contrats", user.username);
    return redirigerAvecMessage("/suppliers", "Fournisseur supprimé", "success");
  });
}
