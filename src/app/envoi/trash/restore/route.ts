import { champ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { restore } from "@/server/corbeille";
import { requireUser } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /trash/restore */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireUser();
    const res = await restore(user, champ(form, "entity_type"), champ(form, "entity_id") || "0", user.username);
    if (res) {
      await auditRecord("restauration", `${res[0]} : ${res[1]}`, "corbeille", user.username);
      invalidateNavCounts();
    }
    return redirigerAvecMessage("/trash", res ? "Élément restauré." : "Restauration impossible.", res ? "success" : "danger");
  });
}
