import { routeChatia } from "@/server/chatia-route";
import { synthese } from "@/server/suivi";

/** GET /api/chatia/synthese : comptes par type et par statut, conformité globale, alertes ouvertes. */
export const GET = routeChatia(() => synthese());
