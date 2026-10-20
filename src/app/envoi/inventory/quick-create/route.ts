import { EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { champ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { reponseApi, requireEditApi } from "@/server/guards";
import { json, lireFormulaire, verifierCsrf } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /inventory/quick-create : création rapide (AJAX) d'un équipement minimal depuis un autre formulaire. */
export async function POST(req: Request) {
  const form = await lireFormulaire(req);
  if (!(await verifierCsrf(req, form))) return json({ ok: false, error: "Jeton CSRF invalide." }, 400);
  const f = form ?? new FormData();
  return reponseApi(async () => {
    const user = await requireEditApi("inventory");
    const name = champ(f, "name");
    if (!name) return json({ ok: false, error: "Le nom est obligatoire." }, 400);
    const kindDemande = champ(f, "kind") || "vm";
    const kind = kindDemande in EQUIPMENT_KIND_LABELS ? kindDemande : "vm";
    const systeme = champ(f, "os") || champ(f, "os_family");
    const eq = await prisma.equipment.create({
      data: { name, kind, os: systeme.slice(0, 128) || null, location: champ(f, "location") || null, observations: champ(f, "observations") || null },
    });
    const label = EQUIPMENT_KIND_LABELS[eq.kind] ?? eq.kind;
    await auditRecord("creation inventaire", `${eq.name} (${label}, ajout rapide)`, "inventory", user.username);
    invalidateNavCounts();
    return json({ ok: true, id: eq.id, name: eq.name, label: `${eq.name} (${label})` });
  });
}
