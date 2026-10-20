import { refreshDomainRdap } from "@/modules/domains/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /domains/<id>/check-rdap */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("domains");
    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) return pasTrouve();
    const [ok, message] = await refreshDomainRdap(domain, user.username);
    invalidateNavCounts();
    return redirigerAvecMessage(`/domains/${id}`, message, ok ? "success" : "danger");
  });
}
