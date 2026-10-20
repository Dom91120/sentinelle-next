import { routeChatia } from "@/server/chatia-route";
import { lireRecherche, lireTypes, recherche } from "@/server/suivi";

/** GET /api/chatia/recherche : éléments suivis dont le nom contient `?q=` (types filtrables). */
export const GET = routeChatia((url) =>
  recherche(lireRecherche(url.searchParams.get("q")), lireTypes(url.searchParams.getAll("type"))),
);
