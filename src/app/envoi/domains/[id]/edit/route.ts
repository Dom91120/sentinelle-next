import { champ } from "@/lib/forms-util";
import { depuisFormulaire, rattacherCertificats } from "@/modules/domains/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /domains/<id>/edit */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    await requireEdit("domains");
    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) return pasTrouve();
    const name = champ(form, "name");
    if (!name)
      return redirigerAvecMessage(
        `/domains/${id}/edit`,
        "Le nom de domaine est obligatoire.",
        "danger",
      );
    await prisma.domain.update({
      where: { id },
      data: { name, ...(await depuisFormulaire(form)) },
    });
    await rattacherCertificats(id);
    invalidateNavCounts();
    return redirigerAvecMessage(`/domains/${id}`, "Domaine modifie avec succes", "success");
  });
}
