/**
 * Garde des intégrations machine-à-machine (port de `_bearer_auth_error` dans app/api.py) :
 * activation + clé Bearer. Une clé PAR consommateur : révoquer l'accès de l'un ne coupe
 * pas l'autre.
 */
import { timingSafeEqual } from "node:crypto";
import type { AppSettings } from "@/server/config-store";
import { json } from "@/server/http";

export function erreurAuthBearer(
  req: Request,
  cfg: AppSettings,
  cleActive: string,
  cleToken: string,
  quoi: string,
): Response | null {
  if (!cfg[cleActive]) return json({ error: `Integration ${quoi} desactivee.` }, 503);
  const token = (cfg[cleToken] as string | undefined) || "";
  if (!token) return json({ error: "API non configuree (cle absente)." }, 503);
  const auth = req.headers.get("authorization") || "";
  const provided = auth.slice(0, 7).toLowerCase() === "bearer " ? auth.slice(7) : "";
  // Comparaison à temps constant : ne fuit ni la longueur ni le préfixe.
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  if (!provided || a.length !== b.length || !timingSafeEqual(a, b))
    return json({ error: "Cle API invalide." }, 401);
  return null;
}

export function erreurSesame(req: Request, cfg: AppSettings): Response | null {
  return erreurAuthBearer(req, cfg, "SESAME_API_ENABLED", "SESAME_API_TOKEN", "Sesame");
}

export function erreurChatia(req: Request, cfg: AppSettings): Response | null {
  return erreurAuthBearer(req, cfg, "CHATIA_API_ENABLED", "CHATIA_API_TOKEN", "chatIA");
}
