import { safeNext, seConnecter } from "@/server/connexion";
import { getCurrentUser } from "@/server/guards";
import { clientIp, redirection, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /login (auth.login) */
export async function POST(req: Request) {
  if (await getCurrentUser()) return redirection("/");
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const retour = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return traiterFormulaire(
    req,
    async (form) => {
      const username = String(form.get("username") ?? "");
      const password = String(form.get("password") ?? "");
      const res = await seConnecter(username, password, await clientIp(), next);
      if (!res.ok) return redirigerAvecMessage(retour, res.message, "danger");
      if (res.twoFactor) return redirection("/2fa");
      return redirection(next ?? "/");
    },
    retour,
  );
}
