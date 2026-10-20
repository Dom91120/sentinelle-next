/**
 * Le formulaire d'un marché rendu SEUL (sans la page autour) : ce que
 * formulaire-inline.js charge dans une liste avec `?inline=1`. Le proxy
 * réécrit `/contracts/create?inline=1` et `/contracts/<id>/edit?inline=1`
 * vers `/fragment/contracts/...`, qui répond ici.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contract } from "@/generated/prisma/client";
import {
  type Couverts,
  couvertsDe,
  type FormContext,
  formContext,
} from "@/modules/contracts/server";
import { FormCorps } from "@/modules/contracts/vues";
import { categoryEnabledIn } from "@/server/features";
import { readFlashes } from "@/server/flash";
import { ApiAuthError, getCurrentUser } from "@/server/guards";
import { csrfToken } from "@/server/http";

export async function fragmentContrat(
  contract: Contract | null,
  logicielsChoisis: number[] = [],
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Connexion requise.", { status: 401 });
  if (!user.canEdit("contracts") || !categoryEnabledIn(user.settings, "contracts"))
    return new Response("Droits insuffisants.", { status: 403 });
  let ctx: FormContext;
  let couverts: Couverts;
  try {
    [ctx, couverts] = await Promise.all([
      formContext(logicielsChoisis),
      contract ? couvertsDe(contract.id) : Promise.resolve({ software: [], equipment: [] }),
    ]);
  } catch (e) {
    if (e instanceof ApiAuthError) return new Response(e.message, { status: e.statut });
    throw e;
  }
  const csrf = await csrfToken();
  const retour = contract ? `/contracts/${contract.id}` : "/contracts";
  const messages = await readFlashes();
  const alertes = messages
    .map(
      ([categorie, message]) =>
        `<div class="alert alert-${categorie === "danger" ? "danger" : "info"} py-2 small">${message.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c)}</div>`,
    )
    .join("");
  const html = renderToStaticMarkup(
    createElement(FormCorps, { contract, ...ctx, couverts, user, csrf, retour, inline: true }),
  );
  return new Response(alertes + html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
