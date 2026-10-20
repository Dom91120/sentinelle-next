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
  // `order_by(func.lower(colonne), modele.id)` : lower() de SQLite ne touche que l'ASCII et
  // l'ordre est celui des points de code, pas celui d'une locale.
  const cle = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const tri = [...lignes].sort((a, b) => {
    const x = cle(a.nom);
    const y = cle(b.nom);
    return x < y ? -1 : x > y ? 1 : a.id - b.id;
  });
  const i = tri.findIndex((l) => l.id === id);
  if (i === -1) return [null, null];
  return [i > 0 ? tri[i - 1] : null, i + 1 < tri.length ? tri[i + 1] : null];
}
