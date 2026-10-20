import { champ, champOuNull } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { reponseApi, requireEditApi } from "@/server/guards";
import { json, lireFormulaire, verifierCsrf } from "@/server/http";

/** POST /suppliers/quick-create : création rapide (AJAX) d'un fournisseur minimal. */
export async function POST(req: Request) {
  const form = await lireFormulaire(req);
  if (!(await verifierCsrf(req, form)))
    return json({ ok: false, error: "Jeton CSRF invalide." }, 400);
  const f = form ?? new FormData();
  return reponseApi(async () => {
    const user = await requireEditApi("suppliers");
    const name = champ(f, "name");
    if (!name) return json({ ok: false, error: "Le nom est obligatoire." }, 400);
    const s = await prisma.supplier.create({
      data: {
        name,
        contactName: champOuNull(f, "contact_name"),
        phone: champOuNull(f, "phone"),
        email: champOuNull(f, "email"),
      },
    });
    await auditRecord(
      "creation fournisseur",
      `${s.name} (ajout rapide)`,
      "contrats",
      user.username,
    );
    return json({ ok: true, id: s.id, name: s.name });
  });
}
