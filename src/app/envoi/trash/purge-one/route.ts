import { champ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { purgeOne } from "@/server/corbeille";
import { requireUser } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /trash/purge-one : le droit can_delete(<catégorie>) est vérifié dans purgeOne. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireUser();
    const res = await purgeOne(user, champ(form, "entity_type"), champ(form, "entity_id") || "0");
    if (res) await auditRecord("suppression definitive", `${res[0]} : ${res[1]}`, "corbeille", user.username);
    return redirigerAvecMessage("/trash", res ? "Élément supprimé définitivement." : "Suppression impossible.", res ? "success" : "danger");
  });
}
