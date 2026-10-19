import { parseDate } from "@/lib/forms-util";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /certificates/<id>/renew */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("certificates");
    const cert = await prisma.certificate.findUnique({ where: { id } });
    if (!cert) return pasTrouve();
    const newExpiry = parseDate(form.get("new_expiry_date"));
    const brut = form.get("comment");
    const comment = typeof brut === "string" ? brut : "Certificat renouvelé";
    if (newExpiry) {
      const auj = new Date();
      const issuedAt = new Date(Date.UTC(auj.getUTCFullYear(), auj.getUTCMonth(), auj.getUTCDate()));
      await prisma.certificate.update({ where: { id }, data: { expiryDate: newExpiry, issuedAt } });
    }
    await prisma.certificateHistory.create({ data: { certificateId: id, action: "renewed", comment, performedBy: user.username } });
    invalidateNavCounts();
    return redirigerAvecMessage(`/certificates/${id}`, "Certificat marqué comme renouvelé", "success");
  });
}
