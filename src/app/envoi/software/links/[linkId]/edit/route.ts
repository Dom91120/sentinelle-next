import { champOuNull, parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /software/links/<link_id>/edit : corrige la description d'un flux. */
export async function POST(req: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const linkId = idDe((await params).linkId);
  if (!linkId) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    await requireFeature("links");
    const lien = await prisma.softwareLink.findUnique({ where: { id: linkId }, include: { source: true, target: true } });
    if (!lien) return pasTrouve();
    const retour = parseInt_(form.get("from_id"), null) || lien.sourceId;
    await prisma.softwareLink.update({ where: { id: linkId }, data: { description: champOuNull(form, "description") } });
    await auditRecord("modification interconnexion", `${lien.source.name} -> ${lien.target.name}`, "inventory", user.username);
    return redirigerAvecMessage(`/software/${retour}#liaisons`, "Flux modifié", "success");
  });
}
