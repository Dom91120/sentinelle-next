/**
 * La fiche précédente et la fiche suivante (port de app/voisins.py) : l'ordre
 * des noms (sans tenir compte de la casse), puis des identifiants. Débrayable
 * dans Préférences (FICHE_NAVIGATION).
 */
import type { AppSettings } from "@/server/config-store";

export type Voisin = { id: number; nom: string };
export type Voisins = [Voisin | null, Voisin | null];

/** (précédente, suivante) de la fiche `id` parmi `lignes` ({id, nom} des fiches actives). */
export function voisinsParmi(lignes: Voisin[], id: number, settings: AppSettings): Voisins {
  if (!settings.FICHE_NAVIGATION) return [null, null];
  const tri = [...lignes].sort((a, b) => {
    const c = a.nom.toLowerCase().localeCompare(b.nom.toLowerCase(), "fr");
    return c !== 0 ? c : a.id - b.id;
  });
  const i = tri.findIndex((l) => l.id === id);
  if (i === -1) return [null, null];
  return [i > 0 ? tri[i - 1] : null, i + 1 < tri.length ? tri[i + 1] : null];
}
