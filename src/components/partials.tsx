/**
 * Partials de fiche : report des alertes (_snooze_card.html), sélecteur
 * d'équipement lié (_equipment_select.html), onglets du matériel (_inventory_nav.html).
 */

import { Icone } from "@/components/icones";
import { QaAddLink, QaModalEquipment } from "@/components/quick-add";
import type { AlertSnooze, Equipment } from "@/generated/prisma/client";
import { ENVIRONMENT_LABELS, EQUIPMENT_KIND_LABELS, permissionCategory } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import type { CurrentUser } from "@/server/guards";

/** `_snooze_card.html` — le report actif est passé par la page (getActiveSnooze). */
export function SnoozeCard({
  entityType,
  entityId,
  user,
  snooze,
  csrf,
}: {
  entityType: string;
  entityId: number;
  user: CurrentUser;
  snooze: AlertSnooze | null;
  csrf: string;
}) {
  if (!user.canEdit(permissionCategory(entityType))) return null;
  return (
    <div className="data-card fiche-alertes mb-3">
      {snooze ? (
        <div className="d-flex align-items-center gap-2">
          <Icone bi="bi-bell-slash" taille="1em" classes="text-muted" />
          <div className="cell2 flex-grow-1">
            <strong>Alertes en pause</strong>
            <small>
              jusqu'au {dateCourte(snooze.snoozedUntil)}
              {snooze.reason ? ` · ${snooze.reason}` : ""}
            </small>
          </div>
          <form method="POST" action="/alerts/unsnooze" data-edition-visible>
            <input type="hidden" name="csrf_token" value={csrf} />
            <input type="hidden" name="entity_type" value={entityType} />
            <input type="hidden" name="entity_id" value={entityId} />
            <button type="submit" className="btn btn-sm btn-outline-secondary">
              Réactiver
            </button>
          </form>
        </div>
      ) : (
        <details>
          <summary className="d-flex align-items-center gap-2">
            <Icone bi="bi-bell" taille="1em" classes="ico-carte ico-emerald" />
            <div className="cell2 flex-grow-1">
              <strong>Alertes actives</strong>
              <small>rappels par mail selon les seuils</small>
            </div>
            <span className="btn btn-sm btn-ghost">Reporter…</span>
          </summary>
          <form method="POST" action="/alerts/snooze" className="mt-2" data-edition-visible>
            <input type="hidden" name="csrf_token" value={csrf} />
            <input type="hidden" name="entity_type" value={entityType} />
            <input type="hidden" name="entity_id" value={entityId} />
            <input
              type="text"
              name="reason"
              className="form-control form-control-sm mb-2"
              placeholder="Raison (optionnel)"
            />
            <div className="d-flex gap-1">
              <button
                type="submit"
                name="days"
                value="7"
                className="btn btn-sm btn-outline-secondary flex-fill"
              >
                7 j
              </button>
              <button
                type="submit"
                name="days"
                value="30"
                className="btn btn-sm btn-outline-secondary flex-fill"
              >
                30 j
              </button>
              <button
                type="submit"
                name="days"
                value="90"
                className="btn btn-sm btn-outline-secondary flex-fill"
              >
                90 j
              </button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}

/** `_equipment_select.html` */
export function EquipmentSelect({
  equipments,
  selectedId,
  compact = false,
  user,
  csrf,
}: {
  equipments: Equipment[];
  selectedId?: number | null;
  compact?: boolean;
  user: CurrentUser;
  csrf: string;
}) {
  const options = equipments.map((e) => (
    <option key={e.id} value={e.id}>
      {e.name} ({EQUIPMENT_KIND_LABELS[e.kind] ?? e.kind}
      {e.environment ? ` · ${ENVIRONMENT_LABELS[e.environment] ?? e.environment}` : ""})
    </option>
  ));
  if (compact) {
    return (
      <>
        <label className="form-label fw-medium" htmlFor="equipmentSelect">
          Équipement lié (inventaire)
        </label>
        <select
          name="equipment_id"
          id="equipmentSelect"
          className="form-select"
          defaultValue={selectedId ?? ""}
        >
          <option value="">— Aucun —</option>
          {options}
        </select>
      </>
    );
  }
  return (
    <>
      <div className="d-flex justify-content-between align-items-center">
        <label className="form-label fw-medium mb-0">Équipement lié (inventaire)</label>
        {user.canEdit("inventory") ? (
          <QaAddLink
            modalId="qaModalEquipment"
            targetId="equipmentSelect"
            text="Nouvel équipement"
          />
        ) : null}
      </div>
      <select
        name="equipment_id"
        id="equipmentSelect"
        className="form-select mt-1"
        defaultValue={selectedId ?? ""}
      >
        <option value="">— Aucun —</option>
        {options}
      </select>
      <small className="text-muted">
        Relie cet élément à un serveur/NAS de l'inventaire (fiche 360°).
      </small>
      {user.canEdit("inventory") ? <QaModalEquipment csrf={csrf} /> : null}
    </>
  );
}

/** `_inventory_nav.html` */
export function InventoryNav({
  active,
  className = "mb-2",
}: {
  active: "serveurs" | "reseau";
  className?: string;
}) {
  return (
    <div className={`seg-tabs${className ? ` ${className}` : ""}`}>
      <a className={`seg-tab${active === "serveurs" ? " active" : ""}`} href="/inventory">
        <Icone bi="bi-hdd-stack" taille="1em" classes="me-1" />
        Serveurs
      </a>
      <a
        className={`seg-tab${active === "reseau" ? " active" : ""}`}
        href="/inventory?famille=reseau"
      >
        <Icone bi="bi-router" taille="1em" classes="me-1" />
        Réseau
      </a>
    </div>
  );
}
