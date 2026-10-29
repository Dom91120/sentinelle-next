/**
 * La fiche précédente et la fiche suivante (port de app/voisins.py), dans l'ordre de la
 * liste du module (`src/server/tri-fiches.ts`) : on feuillette dans l'ordre où l'on vient
 * de lire. Aux deux bouts, pas de voisin : on ne boucle pas. Débrayable dans Préférences
 * (FICHE_NAVIGATION).
 */
import type { AppSettings } from "@/server/config-store";

export type Voisin = { id: number; nom: string };
export type Voisins = [Voisin | null, Voisin | null];

/** (précédente, suivante) de la fiche `id` parmi `lignes`, déjà dans l'ordre de la liste. */
export function voisinsParmi(lignes: Voisin[], id: number, settings: AppSettings): Voisins {
  if (!settings.FICHE_NAVIGATION) return [null, null];
  const i = lignes.findIndex((l) => l.id === id);
  if (i === -1) return [null, null];
  return [i > 0 ? lignes[i - 1] : null, i + 1 < lignes.length ? lignes[i + 1] : null];
}
