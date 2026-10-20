import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /contracts/quotes/<quote_id>/select : marque le devis retenu (au plus un par consultation). */
export async function POST(req: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const quoteId = idDe((await params).quoteId);
  if (!quoteId) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("contracts");
    await requireFeature("quotes");
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { consultation: true, supplier: true } });
    if (!quote) return pasTrouve();
    await prisma.quote.updateMany({ where: { consultationId: quote.consultationId }, data: { selected: false } });
    await prisma.quote.update({ where: { id: quoteId }, data: { selected: true } });
    const who = quote.supplier ? quote.supplier.name : quote.supplierName || "—";
    await auditRecord("devis retenu", `${quote.consultation.subject} : ${who}`, "contrats", user.username);
    return redirigerAvecMessage(`/inventory/logiciels/${quote.consultation.softwareId}`, "Devis marqué comme retenu", "success");
  });
}
