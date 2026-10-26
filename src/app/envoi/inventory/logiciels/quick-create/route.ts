import type { Prisma } from "@/generated/prisma/client";
import { depuisFormulaire } from "@/modules/software/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { enabledIn } from "@/server/features";
import { reponseApi, requireEditApi } from "@/server/guards";
import { json, lireFormulaire, verifierCsrf } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/**
 * POST /software/quick-create : création (AJAX) d'un logiciel depuis un autre formulaire.
 * Les champs sont ceux du formulaire d'une fiche : la modale « Nouvelle application » les
 * reprend tous ; seuls les rattachements (marchés, serveurs, services) ne s'y font pas.
 */
export async function POST(req: Request) {
  const form = await lireFormulaire(req);
  if (!(await verifierCsrf(req, form)))
    return json({ ok: false, error: "Jeton CSRF invalide." }, 400);
  const f = form ?? new FormData();
  return reponseApi(async () => {
    const user = await requireEditApi("software");
    const data = depuisFormulaire(
      f,
      enabledIn(user.settings, "gdpr"),
    ) as Prisma.SoftwareUncheckedCreateInput;
    if (!data.name) return json({ ok: false, error: "Le nom est obligatoire." }, 400);
    const sw = await prisma.software.create({ data });
    await auditRecord("creation logiciel", `${sw.name} (ajout rapide)`, "inventory", user.username);
    invalidateNavCounts();
    return json({ ok: true, id: sw.id, name: sw.name });
  });
}
