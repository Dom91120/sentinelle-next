/**
 * Parsing défensif des champs de formulaire (port de app/forms_util.py).
 * Ces fonctions tolèrent une saisie vide, absente ou non conforme sans lever.
 */

/** Parse une date 'YYYY-MM-DD' en Date à minuit UTC. null si vide ou invalide. */
export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (
    d.getUTCFullYear() !== Number(m[1]) ||
    d.getUTCMonth() !== Number(m[2]) - 1 ||
    d.getUTCDate() !== Number(m[3])
  ) {
    return null;
  }
  return d;
}

/** Parse un entier. Renvoie `def` si vide/non numérique ; borne à `minimum` si fourni. */
export function parseInt_(
  value: unknown,
  def: number | null = null,
  minimum?: number,
): number | null {
  const s = String(value ?? "").trim();
  if (!/^[+-]?\d+$/.test(s)) return def;
  const n = Number.parseInt(s, 10);
  if (minimum !== undefined && n < minimum) return minimum;
  return n;
}

/** Parse un nombre décimal, saisi à la française (« 9 999 999,99 ») ou à l'anglaise. */
export function parseFloat_(value: unknown, def: number | null = null): number | null {
  if (value === null || value === undefined) return def;
  let raw = String(value).trim();
  for (const espace of [" ", " ", " ", " ", "€"]) raw = raw.split(espace).join("");
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  if (!raw) return def;
  const f = Number(raw);
  return Number.isFinite(f) ? f : def;
}

/** Chaîne nettoyée (trim), '' si absente. */
export function champ(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** Chaîne nettoyée ou null si vide. */
export function champOuNull(fd: FormData, name: string): string | null {
  const v = champ(fd, name);
  return v === "" ? null : v;
}

/** Case à cocher : 'on' / '1' / 'true' → vrai. */
export function coche(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "1" || v === "true";
}

/** Identifiant entier positif ou null (« » et « 0 » → null). */
export function idOuNull(fd: FormData, name: string): number | null {
  const n = parseInt_(fd.get(name), null);
  return n && n > 0 ? n : null;
}

/** `YYYY-MM-DD` d'une Date (minuit UTC) pour pré-remplir un <input type=date>. */
export function isoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
