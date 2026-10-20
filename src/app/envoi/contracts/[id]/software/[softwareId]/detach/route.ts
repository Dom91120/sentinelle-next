import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import {
  idDe,
  pasTrouve,
  redirection,
  redirigerAvecMessage,
  traiterFormulaire,
} from "@/server/http";

/** POST /contracts/<id>/software/<software_id>/detach : retire le lien, PAS le marché. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; softwareId: string }> },
) {
  const p = await params;
  const id = idDe(p.id);
  const softwareId = idDe(p.softwareId);
  if (!id || !softwareId) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("contracts");
    const [contrat, sw] = await Promise.all([
      prisma.contract.findUnique({ where: { id } }),
      prisma.software.findUnique({ where: { id: softwareId } }),
    ]);
    if (!contrat || !sw) return pasTrouve();
    const retour = `/inventory/logiciels/${softwareId}`;
    const lien = await prisma.contractSoftware.findUnique({
      where: { contractId_softwareId: { contractId: id, softwareId } },
    });
    if (!lien) return redirection(retour);
    await prisma.contractSoftware.delete({
      where: { contractId_softwareId: { contractId: id, softwareId } },
    });
    await auditRecord(
      "detachement marche",
      `${contrat.name} -> ${sw.name}`,
      "contrats",
      user.username,
    );
    return redirigerAvecMessage(retour, `Marché « ${contrat.name} » détaché`, "success");
  });
}
