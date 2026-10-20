import { champ, parseDate } from "@/lib/forms-util";
import { prisma } from "@/server/db";
import { getCurrentUser, reponseApi, requireEditApi } from "@/server/guards";
import { json, lireFormulaire, verifierCsrf } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /contracts/quick-create : création rapide (AJAX) d'un contrat minimal. */
export async function POST(req: Request) {
  const form = await lireFormulaire(req);
  if (!(await verifierCsrf(req, form)))
    return json({ ok: false, error: "Jeton CSRF invalide." }, 400);
  const f = form ?? new FormData();
  return reponseApi(async () => {
    await requireEditApi("contracts");
    const user = await getCurrentUser();
    const name = champ(f, "name");
    if (!name) return json({ ok: false, error: "Le nom est obligatoire." }, 400);
    const maintenance = await prisma.referential.findFirst({
      where: { kind: "contract_kind", label: "Maintenance" },
    });
    const c = await prisma.contract.create({
      data: {
        name,
        kindId: maintenance?.id ?? null,
        noticeDays: 0,
        endDate: parseDate(f.get("end_date")),
      },
    });
    await prisma.contractHistory.create({
      data: {
        contractId: c.id,
        action: "creation",
        comment: `Contrat cree : ${c.name} (ajout rapide)`,
        performedBy: user?.username ?? null,
      },
    });
    invalidateNavCounts();
    return json({ ok: true, id: c.id, name: c.name });
  });
}
