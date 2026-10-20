import { reponseApi, requireUserApi } from "@/server/guards";
import { json } from "@/server/http";
import { directorySearchAvailable, searchDirectory } from "@/server/ldap";

/**
 * GET /api/directory/search : autocomplétion des responsables depuis l'Active Directory.
 * Réservée aux utilisateurs pouvant éditer. Repli : liste vide si LDAP indisponible.
 */
export async function GET(req: Request) {
  return reponseApi(async () => {
    const user = await requireUserApi();
    if (!user.canEdit()) return json({ error: "Droits insuffisants." }, 403);
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const cfg = user.settings;
    return json({
      available: directorySearchAvailable(cfg),
      results: await searchDirectory(cfg, q),
    });
  });
}
