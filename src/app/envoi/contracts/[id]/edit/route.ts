import { dateCourte } from "@/lib/libelles";
import { depuisFormulaire, poserCouverts } from "@/modules/contracts/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /contracts/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("contracts");
    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) return pasTrouve();
    const { data, couverts } = await depuisFormulaire(form);
    if (!data.name) return redirigerAvecMessage(`/contracts/${id}/edit`, "Le nom du contrat est obligatoire.", "danger");
    const oldEnd = contract.endDate;
    const newEnd = (data.endDate as Date | null) ?? null;
    await prisma.contract.update({ where: { id }, data });
    await poserCouverts(id, couverts);
    if ((oldEnd?.getTime() ?? null) !== (newEnd?.getTime() ?? null)) {
      await prisma.contractHistory.create({
        data: { contractId: id, action: "echeance", comment: `Échéance modifiée : ${oldEnd ? dateCourte(oldEnd) : "-"} -> ${newEnd ? dateCourte(newEnd) : "-"}`, performedBy: user.username },
      });
    }
    invalidateNavCounts();
    return redirigerAvecMessage(`/contracts/${id}`, "Contrat modifié", "success");
  });
}
