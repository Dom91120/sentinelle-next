/** Référentiels et services utilisateurs (port de app/referentials.py) : les règles communes aux routes. */
import { REFERENTIAL_SCOPES } from "@/lib/constantes";

/** La portée demandée si la liste en a et qu'elle est connue ; « tous » pour une liste à portée sans choix valide ; null pour les autres listes. */
export function portee(kind: string, valeur: string | null | undefined): string | null {
  const portees = REFERENTIAL_SCOPES[kind];
  if (!portees) return null;
  return valeur && valeur in portees ? valeur : "tous";
}

export function scopeLabel(kind: string, scope: string | null): string {
  return REFERENTIAL_SCOPES[kind]?.[scope || "tous"] ?? "";
}
