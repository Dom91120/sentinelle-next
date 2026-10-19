/**
 * Le contexte d'une page connectée : ce que base.html recevait de ses
 * processeurs de contexte (utilisateur, compteurs du menu, messages flash,
 * jeton CSRF, nonce CSP, chemin courant, modules actifs).
 */
import { headers } from "next/headers";
import { cache } from "react";
import { type FeatureFlags, allFlagsIn } from "@/server/features";
import { type Flash, readFlashes } from "@/server/flash";
import { type CurrentUser, requireUser } from "@/server/guards";
import { csrfToken } from "@/server/http";
import { navCounts } from "@/server/nav";

export type Page = {
  user: CurrentUser;
  counts: Record<string, number>;
  flashes: Flash[];
  csrf: string;
  nonce: string | undefined;
  pathname: string;
  search: URLSearchParams;
  features: FeatureFlags;
};

export const contextePage = cache(async (): Promise<Page> => {
  const user = await requireUser();
  const h = await headers();
  const [counts, flashes, csrf] = await Promise.all([navCounts(user), readFlashes(), csrfToken()]);
  return {
    user,
    counts,
    flashes,
    csrf,
    nonce: h.get("x-nonce") ?? undefined,
    pathname: h.get("x-pathname") ?? "/",
    search: new URLSearchParams(h.get("x-search") ?? ""),
    features: allFlagsIn(user.settings),
  };
});

/** Le nonce et le jeton CSRF d'une page sans session (connexion, 2FA). */
export async function contexteAnonyme(): Promise<{ nonce: string | undefined; csrf: string; flashes: Flash[] }> {
  const h = await headers();
  const [csrf, flashes] = await Promise.all([csrfToken(), readFlashes()]);
  return { nonce: h.get("x-nonce") ?? undefined, csrf, flashes };
}
