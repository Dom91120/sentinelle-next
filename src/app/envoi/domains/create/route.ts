import { champ } from "@/lib/forms-util";
import { depuisFormulaire, rattacherCertificats } from "@/modules/domains/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /domains/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("domains");
    const name = champ(form, "name");
    if (!name) return redirigerAvecMessage("/domains/create", "Le nom de domaine est obligatoire.", "danger");
    const d = await prisma.domain.create({ data: { name, ...(await depuisFormulaire(form)) } });
    await prisma.domainHistory.create({ data: { domainId: d.id, action: "creation", comment: `Domaine cree : ${d.name}`, performedBy: user.username } });
    const n = await rattacherCertificats(d.id);
    invalidateNavCounts();
    return redirigerAvecMessage("/domains", `Domaine ajoute avec succes${n ? ` (${n} certificat(s) rattaché(s))` : ""}`, "success");
  });
}
