import { flash } from "@/server/flash";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { syncPasswordExpirations } from "@/server/ldap";
import { invalidateNavCounts } from "@/server/nav";

/** POST /accounts/sync-ad */
export async function POST(req: Request) {
  return traiterFormulaire(req, async () => {
    const user = await requireEdit("accounts");
    const [updated, errors] = await syncPasswordExpirations(user.settings);
    if (errors.length) await flash(`Synchro AD : ${errors.slice(0, 3).join(" | ")}`, "warning");
    invalidateNavCounts();
    return redirigerAvecMessage("/accounts", `${updated} compte(s) mis a jour depuis l'AD.`, updated ? "success" : "info");
  });
}
