import { champOuNull, parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { require as requireFeature } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /software/<id>/links/add : déclare un flux depuis cette fiche, dans le sens choisi. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    await requireFeature("links");
    const sw = await prisma.software.findUnique({ where: { id } });
    if (!sw) return pasTrouve();
    const retour = `/software/${id}`;
    const autreId = parseInt_(form.get("other_id"), null);
    const autre = autreId ? await prisma.software.findUnique({ where: { id: autreId } }) : null;
    const sensDemande = form.get("sens");
    const sens = typeof sensDemande === "string" && ["vers", "depuis", "double"].includes(sensDemande) ? sensDemande : "vers";
    if (!autre) return redirigerAvecMessage(retour, "Choisissez le logiciel à l'autre bout du flux.", "danger");
    if (autre.id === sw.id) return redirigerAvecMessage(retour, "Un logiciel ne peut pas alimenter lui-même.", "danger");
    const [source, cible] = sens === "depuis" ? [autre, sw] : [sw, autre];
    const double = sens === "double";
    const existants = await prisma.softwareLink.findMany({
      where: { OR: [{ sourceId: sw.id, targetId: autre.id }, { sourceId: autre.id, targetId: sw.id }] },
    });
    if (existants.some((l) => l.bidirectional)) return redirigerAvecMessage(retour, "Un flux à double sens relie déjà ces deux logiciels.", "warning");
    if (double && existants.length) return redirigerAvecMessage(retour, "Un flux à sens unique relie déjà ces deux logiciels : supprimez-le avant de déclarer le double sens.", "warning");
    if (existants.some((l) => l.sourceId === source.id)) return redirigerAvecMessage(retour, "Ce flux est déjà déclaré.", "warning");
    await prisma.softwareLink.create({ data: { sourceId: source.id, targetId: cible.id, bidirectional: double, description: champOuNull(form, "description") } });
    await auditRecord("ajout interconnexion", `${source.name} ${double ? "<->" : "->"} ${cible.name}`, "inventory", user.username);
    return redirigerAvecMessage(retour, "Flux ajouté", "success");
  });
}
