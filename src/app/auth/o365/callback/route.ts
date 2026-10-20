import { cookies } from "next/headers";
import { O365_STATE_COOKIE } from "@/app/auth/o365/connect/route";
import { getSettings } from "@/server/config-store";
import { getCurrentUser } from "@/server/guards";
import { redirection, redirigerAvecMessage } from "@/server/http";
import { journal } from "@/server/log";
import { completeO365Auth } from "@/server/mailer";

/** GET /auth/o365/callback : retour du consentement, échange du code contre un jeton. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return redirection("/login?next=/preferences");
  if (!user.isAdmin)
    return redirigerAvecMessage("/", "Acces reserve aux administrateurs", "danger");
  const url = new URL(req.url);
  const jar = await cookies();
  const attendu = jar.get(O365_STATE_COOKIE)?.value ?? "";
  jar.delete(O365_STATE_COOKIE);
  try {
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    if (!code)
      throw new Error(
        url.searchParams.get("error_description") ||
          url.searchParams.get("error") ||
          "Aucun code reçu.",
      );
    if (!attendu || state !== attendu)
      throw new Error("État OAuth2 inattendu (flux expiré ou rejoué).");
    const email = await completeO365Auth(await getSettings(), code);
    return redirigerAvecMessage(
      "/preferences",
      `Compte Office 365 connecte avec succes (${email})`,
      "success",
    );
  } catch (e) {
    // Détail (URL tenant, message OAuth…) en journal serveur, pas à l'écran.
    journal.avert("o365", "Echec connexion O365 (callback)", { erreur: e });
    return redirigerAvecMessage(
      "/preferences",
      "Echec de la connexion Office 365. Consultez les journaux serveur.",
      "danger",
    );
  }
}
