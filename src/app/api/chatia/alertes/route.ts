import { routeChatia } from "@/server/chatia-route";
import { alertes, lireOui, lireTypes } from "@/server/suivi";

/** GET /api/chatia/alertes : alertes ouvertes, une par fiche critique ou urgente (`?type=`, `?reportees=1`). */
export const GET = routeChatia((url) =>
  alertes(lireTypes(url.searchParams.getAll("type")), lireOui(url.searchParams.get("reportees"))),
);
