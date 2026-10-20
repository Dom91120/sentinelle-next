import { parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /contracts/software/<software_id>/attach : rattache un marché existant à un logiciel. */
export async function POST(req: Request, { params }: { params: Promise<{ softwareId: string }> }) {
  const softwareId = idDe((await params).softwareId);
  if (!softwareId) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("contracts");
    const sw = await prisma.software.findUnique({ where: { id: softwareId } });
    if (!sw) return pasTrouve();
    const retour = `/software/${softwareId}`;
    const cid = parseInt_(form.get("contract_id"), null) ?? 0;
    const contrat = cid ? await prisma.contract.findUnique({ where: { id: cid } }) : null;
    if (!contrat || !contrat.isActive) return redirigerAvecMessage(retour, "Choisissez le marché à rattacher.", "danger");
    if (await prisma.contractSoftware.findUnique({ where: { contractId_softwareId: { contractId: contrat.id, softwareId } } })) return redirigerAvecMessage(retour, "Ce marché couvre déjà ce logiciel.", "warning");
    await prisma.contractSoftware.create({ data: { contractId: contrat.id, softwareId } });
    await auditRecord("rattachement marche", `${contrat.name} -> ${sw.name}`, "contrats", user.username);
    return redirigerAvecMessage(retour, `Marché « ${contrat.name} » rattaché`, "success");
  });
}
