/**
 * Connecteurs / intégrations externes (port de app/connectors.py) : Sesame, chatIA,
 * webhooks de notification. Réservé aux administrateurs.
 */
import { cookies } from "next/headers";
import type { AppSettings } from "@/server/config-store";

/** Connecteurs machine-à-machine : préfixe → (nom affiché, clé d'activation, clé de l'API, adresse à donner à l'outil). */
export const CARTES_API: Record<string, [string, string, string, string]> = {
  sesame: ["Sesame", "SESAME_API_ENABLED", "SESAME_API_TOKEN", "/api/assets?type=application"],
  // chatIA ajoute lui-même les chemins /api/chatia/… : on lui donne l'adresse de Sentinelle, rien de plus.
  chatia: ["chatIA", "CHATIA_API_ENABLED", "CHATIA_API_TOKEN", ""],
};

export type CarteContext = {
  enabled: boolean;
  keySet: boolean;
  keyMasked: string;
  newKey: string | null;
  endpoint: string;
};

/** Cookie à usage unique qui porte une clé fraîchement générée (affichée UNE fois, copiable). */
export function cookieNouvelleCle(prefixe: string): string {
  return `sentinelle_cle_${prefixe}`;
}

export function masquer(tok: string): string {
  if (tok.length >= 12) return `${tok.slice(0, 6)}…${tok.slice(-4)}`;
  return tok ? "•".repeat(tok.length) : "";
}

export async function carteContext(cfg: AppSettings, prefixe: string): Promise<CarteContext> {
  const [, cleActive, cleToken, chemin] = CARTES_API[prefixe];
  const tok = (cfg[cleToken] as string | undefined) || "";
  const jar = await cookies();
  return {
    enabled: Boolean(cfg[cleActive]),
    keySet: Boolean(tok),
    keyMasked: masquer(tok),
    newKey: jar.get(cookieNouvelleCle(prefixe))?.value || null,
    endpoint: (cfg.APP_BASE_URL || "").replace(/\/+$/, "") + chemin,
  };
}
