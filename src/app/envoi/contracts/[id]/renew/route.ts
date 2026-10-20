import { champ, parseDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /contracts/<id>/renew : nouvelle échéance + trace. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("contracts");
    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) return pasTrouve();
    const newEnd = parseDate(form.get("new_end_date"));
    if (!newEnd)
      return redirigerAvecMessage(
        `/contracts/${id}`,
        "Indiquez la nouvelle date d'échéance.",
        "danger",
      );
    const oldEnd = contract.endDate;
    await prisma.contract.update({ where: { id }, data: { endDate: newEnd } });
    const comment = champ(form, "comment");
    await prisma.contractHistory.create({
      data: {
        contractId: id,
        action: "renouvellement",
        comment: `Renouvelé jusqu'au ${dateCourte(newEnd)}${oldEnd ? ` (précédente échéance : ${dateCourte(oldEnd)})` : ""}${comment ? ` — ${comment}` : ""}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    return redirigerAvecMessage(
      `/contracts/${id}`,
      `Contrat renouvelé jusqu'au ${dateCourte(newEnd)}`,
      "success",
    );
  });
}
