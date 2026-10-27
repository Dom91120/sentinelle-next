import { champOuNull, parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/**
 * POST /software/links/<link_id>/edit : corrige un flux, son sens (lu depuis la fiche `from_id`)
 * et sa description. Un sens absent ou inconnu laisse le sens en l'état.
 */
export async function POST(req: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const linkId = idDe((await params).linkId);
  if (!linkId) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    await requireFeature("links");
    const lien = await prisma.softwareLink.findUnique({
      where: { id: linkId },
      include: { source: true, target: true },
    });
    if (!lien) return pasTrouve();
    const retour = parseInt_(form.get("from_id"), null) || lien.sourceId;
    const page = `/inventory/logiciels/${retour}#liaisons`;
    // Le sens se lit depuis la fiche d'où l'on modifie : « vers » = cette fiche alimente l'autre.
    const ici = retour === lien.targetId ? lien.target : lien.source;
    const autre = ici.id === lien.sourceId ? lien.target : lien.source;
    const sensDemande = form.get("sens");
    const sens =
      typeof sensDemande === "string" && ["vers", "depuis", "double"].includes(sensDemande)
        ? sensDemande
        : null;
    let sourceId = lien.sourceId;
    let targetId = lien.targetId;
    let double = lien.bidirectional ?? false;
    if (sens) {
      [sourceId, targetId] = sens === "depuis" ? [autre.id, ici.id] : [ici.id, autre.id];
      double = sens === "double";
      const autres = await prisma.softwareLink.findMany({
        where: {
          id: { not: linkId },
          OR: [
            { sourceId: ici.id, targetId: autre.id },
            { sourceId: autre.id, targetId: ici.id },
          ],
        },
      });
      if (double && autres.length)
        return redirigerAvecMessage(
          page,
          "Un autre flux relie déjà ces deux logiciels : supprimez-le avant de déclarer le double sens.",
          "warning",
        );
      if (autres.some((l) => l.sourceId === sourceId))
        return redirigerAvecMessage(page, "Ce flux est déjà déclaré dans ce sens.", "warning");
    }
    await prisma.softwareLink.update({
      where: { id: linkId },
      data: {
        sourceId,
        targetId,
        bidirectional: double,
        description: champOuNull(form, "description"),
      },
    });
    const source = sourceId === lien.sourceId ? lien.source : lien.target;
    const cible = targetId === lien.targetId ? lien.target : lien.source;
    await auditRecord(
      "modification interconnexion",
      `${source.name} ${double ? "<->" : "->"} ${cible.name}`,
      "inventory",
      user.username,
    );
    return redirigerAvecMessage(page, "Flux modifié", "success");
  });
}
