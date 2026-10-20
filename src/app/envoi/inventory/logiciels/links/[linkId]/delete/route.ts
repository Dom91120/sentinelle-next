import { parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireDelete } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /software/links/<link_id>/delete */
export async function POST(req: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const linkId = idDe((await params).linkId);
  if (!linkId) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireDelete("software");
    await requireFeature("links");
    const lien = await prisma.softwareLink.findUnique({ where: { id: linkId }, include: { source: true, target: true } });
    if (!lien) return pasTrouve();
    const retour = parseInt_(form.get("from_id"), null) || lien.sourceId;
    const detail = `${lien.source.name} -> ${lien.target.name}`;
    await prisma.softwareLink.delete({ where: { id: linkId } });
    await auditRecord("suppression interconnexion", detail, "inventory", user.username);
    return redirigerAvecMessage(`/inventory/logiciels/${retour}`, "Flux supprimé", "success");
  });
}
