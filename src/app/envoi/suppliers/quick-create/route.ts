import type { Prisma } from "@/generated/prisma/client";
import { depuisFormulaire } from "@/modules/suppliers/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { reponseApi, requireEditApi } from "@/server/guards";
import { json, lireFormulaire, verifierCsrf } from "@/server/http";

/**
 * POST /suppliers/quick-create : création (AJAX) d'un fournisseur depuis un autre formulaire.
 * Les champs sont ceux du formulaire d'une fiche : la modale « Nouveau fournisseur » les
 * reprend tous.
 */
export async function POST(req: Request) {
  const form = await lireFormulaire(req);
  if (!(await verifierCsrf(req, form)))
    return json({ ok: false, error: "Jeton CSRF invalide." }, 400);
  const f = form ?? new FormData();
  return reponseApi(async () => {
    const user = await requireEditApi("suppliers");
    const data = depuisFormulaire(f) as Prisma.SupplierUncheckedCreateInput;
    if (!data.name) return json({ ok: false, error: "Le nom est obligatoire." }, 400);
    const s = await prisma.supplier.create({ data });
    await auditRecord(
      "creation fournisseur",
      `${s.name} (ajout rapide)`,
      "contrats",
      user.username,
    );
    return json({ ok: true, id: s.id, name: s.name });
  });
}
