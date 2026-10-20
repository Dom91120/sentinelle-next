import { SNOOZE_VALID_TYPES, entityUrl, permissionCategory } from "@/lib/constantes";
import { champ } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { requireUser } from "@/server/guards";
import { redirigerAvecMessage, referer, traiterFormulaire } from "@/server/http";
import { setSnooze } from "@/server/snooze";

/** POST /alerts/snooze : reporte les alertes d'un élément pour N jours. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireUser();
    const entityType = champ(form, "entity_type");
    const entityId = champ(form, "entity_id");
    const days = champ(form, "days") || "7";
    const reason = champ(form, "reason") || null;
    const retour = referer(req, "/");
    if (!(SNOOZE_VALID_TYPES as readonly string[]).includes(entityType) || !/^\d+$/.test(entityId) || !/^\d+$/.test(days)) return redirigerAvecMessage(retour, "Report impossible : parametres invalides.", "danger");
    if (!user.canEdit(permissionCategory(entityType))) return redirigerAvecMessage(retour, "Vous n'avez pas les droits pour reporter cette alerte.", "danger");
    const until = await setSnooze(entityType, Number.parseInt(entityId, 10), Number.parseInt(days, 10), reason, user.username);
    return redirigerAvecMessage(entityUrl(entityType, Number.parseInt(entityId, 10)), `Alerte reportee jusqu'au ${dateCourte(until)}.`, "success");
  });
}
