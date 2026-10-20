/**
 * Vocabulaire unique des statuts et des délais (port de app/libelles.py).
 *
 * Les modèles renvoient une couleur (danger / warning / info / success) ; tout ce
 * qui l'affiche à un humain passe par ces fonctions.
 * - danger  → Critique  : échéance dépassée ou sous le seuil critique.
 * - warning → Urgent    : sous le seuil d'alerte.
 * - info    → À prévoir : sous le seuil d'information.
 * - success → OK        : rien à faire.
 * - autre   → Non suivi : pas d'échéance, hors surveillance, inconnu.
 */

export const STATUS_LABELS: Record<string, string> = {
  danger: "Critique",
  warning: "Urgent",
  info: "À prévoir",
  success: "OK",
};
export const STATUS_LABEL_DEFAULT = "Non suivi";

export const STATUS_LABELS_PLURAL: Record<string, string> = {
  danger: "critiques",
  warning: "urgents",
  info: "à prévoir",
  success: "OK",
};

export const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critique",
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

/** Libellé français d'une couleur de statut. */
export function statusLabel(status: string | null | undefined, fallback?: string): string {
  if (status && status in STATUS_LABELS) return STATUS_LABELS[status];
  return fallback !== undefined ? fallback : STATUS_LABEL_DEFAULT;
}

export function statusLabelPlural(status: string | null | undefined): string {
  return (status && STATUS_LABELS_PLURAL[status]) || STATUS_LABEL_DEFAULT.toLowerCase();
}

/** « 1 critique », « 2 critiques », « 3 à prévoir », « 4 OK » : le compteur et son mot, accordés. */
export function compte(n: number | null | undefined, status: string): string {
  const nb = Number(n ?? 0) || 0;
  let mot = STATUS_LABELS_PLURAL[status] ?? STATUS_LABEL_DEFAULT.toLowerCase();
  if (nb === 1 && mot.endsWith("s") && mot !== "à prévoir") mot = mot.slice(0, -1);
  return `${nb} ${mot}`;
}

/** Libellé d'une priorité ; une valeur inconnue est rendue telle quelle. */
export function priorityLabel(value: string | null | undefined): string {
  if (!value) return "";
  return PRIORITY_LABELS[value] ?? String(value);
}

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Un montant en français : « 1 191,64 € », « 32 000 € ». Les centimes ne paraissent que s'il y en a. */
export function montant(value: number | string | null | undefined, unite = "€"): string {
  if (value === null || value === undefined || value === "") return "";
  const v = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (Number.isNaN(v)) return String(value);
  const entier = Math.abs(v) === Math.trunc(Math.abs(v));
  const abs = Math.abs(v);
  const fixe = entier ? abs.toFixed(0) : abs.toFixed(2);
  const [partieEntiere, decimales] = fixe.split(".");
  const groupes = partieEntiere.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const signe = v < 0 ? "-" : "";
  const texte = decimales !== undefined ? `${signe}${groupes},${decimales}` : `${signe}${groupes}`;
  return unite ? `${texte} ${unite}` : texte;
}

/** Date calendaire (minuit UTC) d'aujourd'hui. */
export function aujourdhui(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Nombre de jours calendaires entre deux dates (UTC). */
export function diffJours(d: Date, depuis: Date = aujourdhui()): number {
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const b = Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

/** « mercredi 17 septembre 2026 », sans dépendre de la locale du serveur. */
export function dateLongue(d: Date | null | undefined): string {
  if (!d) return "";
  const jour = (d.getUTCDay() + 6) % 7;
  return `${JOURS[jour]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** « 17/09/2026 » (équivalent de strftime('%d/%m/%Y')). */
export function dateCourte(d: Date | null | undefined): string {
  if (!d) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

/**
 * « 17/09/2026 14:05 » (équivalent de strftime('%d/%m/%Y %H:%M')). Sentinelle stocke des
 * datetimes UTC naïfs et les affiche sans conversion : on fait pareil (UTC), pour que les
 * deux applications montrent la même heure.
 */
export function dateHeure(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })
    .format(d)
    .replace(",", "");
}

/** Nombre de jours entre aujourd'hui et `value` (date ou entier déjà calculé). null si pas de date. */
export function jours(
  value: Date | number | null | undefined | string,
  today?: Date,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "number") return Math.trunc(value);
  if (value instanceof Date) return diffJours(value, today);
  return null;
}

/**
 * Un délai en français, relatif, jamais un nombre signé.
 *   -5 → « en retard de 5 j », 0 → « aujourd'hui », 1 → « demain », 12 → « dans 12 j », null → ''.
 */
export function delai(
  value: Date | number | null | undefined,
  passe = "en retard de",
  futur = "dans",
  today?: Date,
): string {
  const d = jours(value, today);
  if (d === null) return "";
  if (d < 0) return `${passe} ${-d} j`;
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "demain";
  return `${futur} ${d} j`;
}

/** Liste de champs manquants → « a, b et c » (filtre `manques`). */
export function manques(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

/** La taille dans l'unité où on la lit : « 1,2 Mo » et non 1258291. */
export function tailleLabel(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v < 1024) return `${v} o`;
  if (v < 1024 * 1024) return `${Math.round(v / 1024)} Ko`;
  return `${(v / (1024 * 1024)).toFixed(1)} Mo`.replace(".", ",");
}
