import { depuisFormulaire } from "@/modules/inventory/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /inventory/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("inventory");
    const item = await prisma.equipment.findUnique({ where: { id } });
    if (!item) return pasTrouve();
    const data = depuisFormulaire(form);
    if (!data.name) return redirigerAvecMessage(`/inventory/${id}/edit`, "Le nom est obligatoire.", "danger");
    await prisma.equipment.update({ where: { id }, data });
    await auditRecord("modification inventaire", data.name, "inventory", user.username);
    invalidateNavCounts();
    return redirigerAvecMessage(`/inventory/${id}`, "Équipement modifié", "success");
  });
}
