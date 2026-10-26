import { EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { champ } from "@/lib/forms-util";
import { depuisFormulaire } from "@/modules/inventory/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { reponseApi, requireEditApi } from "@/server/guards";
import { json, lireFormulaire, verifierCsrf } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/**
 * POST /inventory/quick-create : création (AJAX) d'un équipement depuis un autre formulaire.
 * Les champs sont ceux du formulaire d'une fiche (la modale « Nouvel équipement » les
 * reprend tous) ; la modale « Nouveau serveur » n'envoie que nom, type, système, emplacement.
 */
export async function POST(req: Request) {
  const form = await lireFormulaire(req);
  if (!(await verifierCsrf(req, form)))
    return json({ ok: false, error: "Jeton CSRF invalide." }, 400);
  const f = form ?? new FormData();
  return reponseApi(async () => {
    const user = await requireEditApi("inventory");
    const data = depuisFormulaire(f);
    if (!data.name) return json({ ok: false, error: "Le nom est obligatoire." }, 400);
    // « Nouveau serveur » : la famille de système (Windows / Linux) tient lieu de système.
    if (!data.os && champ(f, "os_family")) data.os = champ(f, "os_family").slice(0, 128);
    const eq = await prisma.equipment.create({ data });
    const label = EQUIPMENT_KIND_LABELS[eq.kind] ?? eq.kind;
    await auditRecord(
      "creation inventaire",
      `${eq.name} (${label}, ajout rapide)`,
      "inventory",
      user.username,
    );
    invalidateNavCounts();
    return json({ ok: true, id: eq.id, name: eq.name, label: `${eq.name} (${label})` });
  });
}
