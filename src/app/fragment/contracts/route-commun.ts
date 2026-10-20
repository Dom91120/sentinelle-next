/**
 * Le formulaire d'un marché rendu SEUL (sans la page autour) : ce que
 * formulaire-inline.js charge dans une liste avec `?inline=1`. Le proxy
 * réécrit `/contracts/create?inline=1` et `/contracts/<id>/edit?inline=1`
 * vers `/fragment/contracts/...`, qui répond ici en découpant la page-support
 * `/fragment-page/contracts/...` (cf. server/fragment.ts).
 */
import { fragmentDepuisPage } from "@/server/fragment";

export async function fragmentContrat(
  req: Request,
  contractId: number | null,
  params: Record<string, string | null | undefined> = {},
): Promise<Response> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const chemin = contractId
    ? `/fragment-page/contracts/${contractId}/edit`
    : "/fragment-page/contracts/create";
  const suffixe = q.toString() ? `?${q.toString()}` : "";
  return fragmentDepuisPage(req, `${chemin}${suffixe}`);
}
