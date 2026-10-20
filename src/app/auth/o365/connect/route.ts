import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getSettings } from "@/server/config-store";
import { getCurrentUser } from "@/server/guards";
import { redirection, redirigerAvecMessage } from "@/server/http";
import { journal } from "@/server/log";
import { getO365AuthUrl } from "@/server/mailer";

export const O365_STATE_COOKIE = "sentinelle_o365_state";

/** GET /auth/o365/connect : lance le consentement OAuth2 Microsoft (admin). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return redirection("/login?next=/preferences");
  if (!user.isAdmin)
    return redirigerAvecMessage("/", "Acces reserve aux administrateurs", "danger");
  try {
    const cfg = await getSettings();
    const state = randomBytes(16).toString("hex");
    const url = await getO365AuthUrl(cfg, state);
    if (url) {
      (await cookies()).set(O365_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
        secure: process.env.NODE_ENV === "production",
      });
      return redirection(url);
    }
    return redirigerAvecMessage(
      "/preferences",
      "Configuration O365 incomplete. Renseignez Client ID, Tenant ID et Client Secret.",
      "danger",
    );
  } catch (e) {
    journal.avert("o365", "Echec initialisation OAuth2 O365", { erreur: e });
    return redirigerAvecMessage(
      "/preferences",
      "Erreur lors de l'initialisation de la connexion Office 365.",
      "danger",
    );
  }
}
