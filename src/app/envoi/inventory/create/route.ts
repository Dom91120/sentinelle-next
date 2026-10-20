import { EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { depuisFormulaire } from "@/modules/inventory/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /inventory/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("inventory");
    const data = depuisFormulaire(form);
    if (!data.name)
      return redirigerAvecMessage("/inventory/create", "Le nom est obligatoire.", "danger");
    const eq = await prisma.equipment.create({ data });
    await auditRecord(
      "creation inventaire",
      `${eq.name} (${EQUIPMENT_KIND_LABELS[eq.kind] ?? eq.kind})`,
      "inventory",
      user.username,
    );
    invalidateNavCounts();
    return redirigerAvecMessage(`/inventory/${eq.id}`, "Équipement ajouté", "success");
  });
}
