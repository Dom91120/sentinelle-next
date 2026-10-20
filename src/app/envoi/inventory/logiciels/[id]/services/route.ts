import { parseInt_ } from "@/lib/forms-util";
import { poserServices } from "@/modules/software/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirection, traiterFormulaire } from "@/server/http";

/** POST /software/<id>/services : les services qui se servent du logiciel (grille de cases). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    const item = await prisma.software.findUnique({ where: { id } });
    if (!item) return pasTrouve();
    const ids = form
      .getAll("user_service_ids")
      .map((v) => parseInt_(v, null))
      .filter((v): v is number => Boolean(v));
    const n = await poserServices(id, ids);
    await auditRecord("services utilisateurs", `${item.name} : ${n} service(s)`, "inventory", user.username);
    return redirection(`/inventory/logiciels/${id}#liaisons`);
  });
}
