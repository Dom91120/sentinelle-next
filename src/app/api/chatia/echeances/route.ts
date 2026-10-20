import { routeChatia } from "@/server/chatia-route";
import { echeances, lireHorizon, lireTypes } from "@/server/suivi";

/** GET /api/chatia/echeances : éléments à échéance dans `?dans=<jours>` (30 par défaut) ou en retard, `?type=` filtrable. */
export const GET = routeChatia((url) =>
  echeances(lireHorizon(url.searchParams.get("dans")), lireTypes(url.searchParams.getAll("type"))),
);
