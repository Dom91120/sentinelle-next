/**
 * Macros partagées (port de _macros.html) : le badge de statut et le délai.
 */
import { delai, jours, STATUS_LABELS, statusLabel } from "@/lib/libelles";

/** status_badge(status) : UNE couleur, UN mot, partout. */
export function StatusBadge({
  status,
  fallback,
}: {
  status: string | null | undefined;
  fallback?: string;
}) {
  const cls = status && status in STATUS_LABELS ? status : "muted";
  return <span className={`badge-status badge-${cls}`}>{statusLabel(status, fallback)}</span>;
}

const COULEURS: Record<string, string> = {
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
  success: "text-success",
};

/** delai_badge(days, status, passe) : le délai en français, dans la couleur du statut. */
export function DelaiBadge({
  days,
  status,
  passe = "en retard de",
}: {
  days: Date | number | null | undefined;
  status?: string | null;
  passe?: string;
}) {
  const d = jours(days);
  if (d === null) return null;
  const couleur = (status && COULEURS[status]) || (d < 0 ? "text-danger" : "text-muted");
  return <span className={`delai ${couleur}`}>{delai(d, passe)}</span>;
}
