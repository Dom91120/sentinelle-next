import { prisma } from "@/server/db";
import { idDe, pasTrouve } from "@/server/http";
import { fragmentContrat } from "../../route-commun";

/** GET /contracts/<id>/edit?inline=1 (réécrit ici par le proxy) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return pasTrouve();
  return fragmentContrat(contract);
}
