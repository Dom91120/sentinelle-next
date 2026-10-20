/** Les lectures chatIA (app/api.py) : garde Bearer, paramètres invalides en 400, pas de cache. */
import { erreurChatia } from "@/server/api-cle";
import { type AppSettings, getSettings } from "@/server/config-store";

export function routeChatia(lire: (url: URL, cfg: AppSettings) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    const cfg = await getSettings();
    const err = erreurChatia(req, cfg);
    if (err) return err;
    try {
      const data = await lire(new URL(req.url), cfg);
      // Les échéances changent d'un jour à l'autre : pas de mise en cache.
      return Response.json(data, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (
        (e instanceof Error && e.message.startsWith("Paramètre")) ||
        (e instanceof Error && e.message.startsWith("Type inconnu"))
      ) {
        return Response.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
  };
}
