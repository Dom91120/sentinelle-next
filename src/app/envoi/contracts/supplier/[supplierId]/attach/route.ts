import { parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/**
 * POST /contracts/supplier/<supplier_id>/attach : rattache un contrat existant à un fournisseur.
 * Un contrat n'a qu'un fournisseur : s'il en avait un autre, il en change.
 */
export async function POST(req: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const supplierId = idDe((await params).supplierId);
  if (!supplierId) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("contracts");
    const fournisseur = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!fournisseur) return pasTrouve();
    const retour = `/suppliers/${supplierId}#contrats`;
    const cid = parseInt_(form.get("contract_id"), null) ?? 0;
    const contrat = cid ? await prisma.contract.findUnique({ where: { id: cid } }) : null;
    if (!contrat?.isActive)
      return redirigerAvecMessage(retour, "Choisissez le contrat à rattacher.", "danger");
    if (contrat.supplierId === supplierId)
      return redirigerAvecMessage(
        retour,
        "Ce contrat est déjà rattaché à ce fournisseur.",
        "warning",
      );
    await prisma.contract.update({ where: { id: contrat.id }, data: { supplierId } });
    await auditRecord(
      "rattachement contrat",
      `${contrat.name} -> ${fournisseur.name}`,
      "contrats",
      user.username,
    );
    return redirigerAvecMessage(retour, `Contrat « ${contrat.name} » rattaché`, "success");
  });
}
