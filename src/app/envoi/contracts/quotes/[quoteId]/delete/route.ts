import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /contracts/quotes/<quote_id>/delete */
export async function POST(req: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const quoteId = idDe((await params).quoteId);
  if (!quoteId) return pasTrouve();
  return traiterFormulaire(req, async () => {
    await requireDelete("contracts");
    await requireFeature("quotes");
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { consultation: true } });
    if (!quote) return pasTrouve();
    await prisma.quote.delete({ where: { id: quoteId } });
    return redirigerAvecMessage(`/inventory/logiciels/${quote.consultation.softwareId}`, "Devis supprimé", "success");
  });
}
