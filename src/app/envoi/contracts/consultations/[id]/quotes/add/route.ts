import { champ, parseDate, parseFloat_, parseInt_ } from "@/lib/forms-util";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /contracts/consultations/<consultation_id>/quotes/add */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const consultationId = idDe((await params).id);
  if (!consultationId) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    await requireEdit("contracts");
    await requireFeature("quotes");
    const cons = await prisma.consultation.findUnique({ where: { id: consultationId } });
    if (!cons) return pasTrouve();
    const retour = `/inventory/logiciels/${cons.softwareId}`;
    const sid = parseInt_(form.get("supplier_id"), null);
    const nom = champ(form, "supplier_name");
    if (!sid && !nom)
      return redirigerAvecMessage(
        retour,
        "Indiquez le fournisseur qui a remis le devis.",
        "danger",
      );
    const notes = form.get("notes");
    await prisma.quote.create({
      data: {
        consultationId,
        supplierId: sid,
        supplierName: sid ? null : nom,
        amount: parseFloat_(form.get("amount")),
        date: parseDate(form.get("date")),
        notes: typeof notes === "string" && notes ? notes : null,
      },
    });
    return redirigerAvecMessage(retour, "Devis ajouté", "success");
  });
}
