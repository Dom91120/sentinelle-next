"use client";

import { useEffect } from "react";

/**
 * Charge les scripts de Sentinelle APRÈS l'hydratation React.
 *
 * Pourquoi : ces scripts (filtres de colonnes, onglets, synthèse…) modifient le
 * DOM dès leur exécution. S'ils tournent avant l'hydratation, React trouve un
 * HTML différent de celui qu'il a rendu, jette l'arbre et le reconstruit : les
 * éléments injectés et les écouteurs posés disparaissent. Les pages les
 * déclarent donc inertes (`<script type="text/x-differe" data-src>`), et ce
 * composant les rejoue, dans l'ordre, une fois React en place.
 *
 * Les scripts attendent `DOMContentLoaded`, déjà passé : les écouteurs qu'ils
 * posent sont collectés puis appelés, dans l'ordre, après le dernier script,
 * exactement comme le navigateur l'aurait fait.
 */
declare global {
  interface Window {
    __sentinelleScriptsCharges?: boolean;
  }
}

async function charger() {
  const tous = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="text/x-differe"]'));
  // Le socle (rang 1) d'abord, puis les scripts de la page (rang 2), chacun dans l'ordre du document.
  const inertes = [...tous.filter((s) => s.dataset.rang !== "2"), ...tous.filter((s) => s.dataset.rang === "2")];
  if (!inertes.length) return;
  const attente: EventListenerOrEventListenerObject[] = [];
  const original = document.addEventListener;
  document.addEventListener = function (type: string, fn: EventListenerOrEventListenerObject | null, opts?: boolean | AddEventListenerOptions) {
    if (type === "DOMContentLoaded" && fn) {
      attente.push(fn);
      return;
    }
    return original.call(document, type, fn as EventListenerOrEventListenerObject, opts);
  } as typeof document.addEventListener;
  try {
    for (const inerte of inertes) {
      await new Promise<void>((resolve) => {
        const el = document.createElement("script");
        el.nonce = inerte.nonce || inerte.getAttribute("nonce") || "";
        const src = inerte.dataset.src;
        if (src) {
          el.src = src;
          el.onload = () => resolve();
          el.onerror = () => resolve();
          inerte.after(el);
        } else {
          el.textContent = inerte.textContent;
          inerte.after(el);
          resolve();
        }
      });
    }
  } finally {
    document.addEventListener = original;
  }
  const ev = new Event("DOMContentLoaded");
  for (const fn of attente) {
    try {
      if (typeof fn === "function") fn.call(document, ev);
      else fn.handleEvent(ev);
    } catch (e) {
      console.error(e);
    }
  }
  document.documentElement.dataset.pret = "1";
  document.dispatchEvent(new Event("sentinelle:pret"));
}

export function ChargeurScripts() {
  useEffect(() => {
    if (window.__sentinelleScriptsCharges) return;
    window.__sentinelleScriptsCharges = true;
    void charger();
  }, []);
  return null;
}
