import { depuisFormulaire } from "@/modules/suppliers/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /suppliers/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("suppliers");
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return pasTrouve();
    const data = depuisFormulaire(form);
    await prisma.supplier.update({ where: { id }, data });
    await auditRecord(
      "modification fournisseur",
      String(data.name ?? supplier.name),
      "contrats",
      user.username,
    );
    return redirigerAvecMessage(`/suppliers/${id}`, "Fournisseur modifié", "success");
  });
}
