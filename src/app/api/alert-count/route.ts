import { reponseApi, requireUserApi } from "@/server/guards";
import { chargerTout } from "@/server/donnees";
import { json } from "@/server/http";
import { activeSnoozeKeys } from "@/server/snooze";

/** GET /api/alert-count : le nombre d'entités en statut critique par catégorie (toasts). */
export async function GET() {
  return reponseApi(async () => {
    const user = await requireUserApi();
    const [tout, snoozed] = await Promise.all([chargerTout(), activeSnoozeKeys()]);
    const cnt = (items: { id: number; status: string }[], etype: string) => items.filter((i) => !snoozed.has(`${etype}:${i.id}`) && i.status === "danger").length;
    const cats: Record<string, number> = {};
    if (user.canView("accounts")) cats.accounts = cnt(tout.accounts, "account");
    if (user.canView("certificates")) cats.certificates = cnt(tout.certificates, "certificate");
    if (user.canView("domains")) cats.domains = cnt(tout.domains, "domain");
    if (user.canView("backups")) cats.backups = cnt(tout.backups, "backup");
    if (user.canView("tests")) cats.tests = cnt(tout.tests, "test");
    if (user.canView("reviews")) cats.reviews = cnt(tout.reviews, "review");
    if (user.canView("updates")) cats.updates = cnt(tout.updates, "update");
    if (user.canView("inventory")) cats.inventory = cnt(tout.equipments, "equipment");
    if (user.canView("software")) cats.software = cnt(tout.software, "software");
    if (user.canView("contracts")) cats.contracts = cnt(tout.contracts, "contract");
    return json({ danger: Object.values(cats).reduce((a, b) => a + b, 0), by_category: cats });
  });
}
