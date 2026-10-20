import { entityUrl, permissionCategory, SNOOZE_VALID_TYPES } from "@/lib/constantes";
import { champ } from "@/lib/forms-util";
import { requireUser } from "@/server/guards";
import { redirigerAvecMessage, referer, traiterFormulaire } from "@/server/http";
import { clearSnooze } from "@/server/snooze";

/** POST /alerts/unsnooze : annule le report, les alertes reprennent. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireUser();
    const entityType = champ(form, "entity_type");
    const entityId = champ(form, "entity_id");
    const retour = referer(req, "/");
    if (!(SNOOZE_VALID_TYPES as readonly string[]).includes(entityType) || !/^\d+$/.test(entityId))
      return redirigerAvecMessage(retour, "Operation impossible.", "danger");
    if (!user.canEdit(permissionCategory(entityType)))
      return redirigerAvecMessage(
        retour,
        "Vous n'avez pas les droits pour cette action.",
        "danger",
      );
    await clearSnooze(entityType, Number.parseInt(entityId, 10));
    return redirigerAvecMessage(
      entityUrl(entityType, Number.parseInt(entityId, 10)),
      "Report annule, les alertes reprennent.",
      "success",
    );
  });
}
