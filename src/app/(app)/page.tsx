import { Icone } from "@/components/icones";
import { DelaiBadge, StatusBadge } from "@/components/macros";
import { compte, dateCourte, dateLongue } from "@/lib/libelles";
import { DOMAINES } from "@/lib/navigation";
import { DASHBOARD_WIDGETS, type DashboardData, dashboardData, type StatCard } from "@/server/dashboard";
import type { Counts } from "@/server/dashboard";
import { contextePage } from "@/server/page";

export const metadata = { title: "Tableau de bord - Sentinelle" };

const BACKUP_TYPES: Record<string, string> = { full: "Complet", incremental: "Incremental", differential: "Differentiel", snapshot: "Snapshot" };
const CAT_LABELS: Record<string, string> = {
  account: "Comptes",
  certificate: "Certificats",
  domain: "Domaines",
  backup: "Sauvegardes",
  test: "Tests",
  review: "Revues",
  update: "Mises à jour",
  contract: "Contrats",
  equipment: "Matériel",
  software: "Logiciels",
};
const ICONES: Record<string, string> = {
  account: "bi-key",
  certificate: "bi-award",
  domain: "bi-globe",
  backup: "bi-cloud-arrow-up",
  test: "bi-clipboard-check",
  review: "bi-person-check",
  update: "bi-arrow-up-circle",
  contract: "bi-file-earmark-text",
  equipment: "bi-hdd-stack",
  software: "bi-window-stack",
};
const HORIZONS: [string, string, string][] = [
  ["depasse", "Dépassé", "danger"],
  ["semaine", "Cette semaine", "warning"],
  ["a-traiter", "À traiter", "warning"],
  ["mois", "Ce mois-ci", "info"],
  ["plus-tard", "Plus tard", "info"],
];

const URGENT_FILTER_JS = `(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('#urgentList .urgent-row'));
  var groupes = Array.prototype.slice.call(document.querySelectorAll('#urgentList .urgent-groupe'));
  var filters = document.querySelectorAll('.urgent-filter');
  var empty = document.getElementById('urgentEmpty');
  if (!rows.length) return;
  function render(cat) {
    var visibles = 0;
    rows.forEach(function (el) {
      var ok = !cat || el.getAttribute('data-cat') === cat;
      el.style.display = ok ? '' : 'none';
      if (ok) visibles++;
    });
    groupes.forEach(function (g) {
      var cle = g.getAttribute('data-groupe');
      var n = rows.filter(function (r) { return r.getAttribute('data-groupe') === cle && r.style.display !== 'none'; }).length;
      g.style.display = n ? '' : 'none';
    });
    empty.classList.toggle('d-none', visibles > 0);
  }
  filters.forEach(function (b) {
    b.addEventListener('click', function () {
      filters.forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      render(b.getAttribute('data-cat'));
    });
  });
})();`;

const TOOLTIP_JS = `document.addEventListener('DOMContentLoaded', function() {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(function(tooltipTriggerEl) { new bootstrap.Tooltip(tooltipTriggerEl); });
});`;

function domaineDe(key: string): string {
  for (const d of DOMAINES) for (const e of d.entries) if (e.blueprint === key) return d.key;
  return "";
}

function Carte({ c, s }: { c: StatCard; s: Counts }) {
  const total = s.total || 0;
  const label = c.singulier && total <= 1 ? c.singulier : c.label;
  const dom = domaineDe(c.key);
  const pct = (n: number) => `${Math.round((n / total) * 1000) / 10}%`;
  return (
    <a href={c.href} className="stat-card text-decoration-none" style={{ "--cat-color": c.color } as React.CSSProperties} data-card={c.key}>
      <span className="stat-toggle" role="button" tabIndex={-1} title="Masquer / afficher cette vignette" aria-hidden="true">
        <Icone bi="bi-eye-slash" taille="1em" />
      </span>
      <div className="d-flex align-items-center gap-2">
        <div className={`stat-icon${dom ? ` dom-${dom}` : ""}`}>
          <Icone bi={c.icon} taille={20} />
        </div>
        <div className="stat-texte flex-grow-1 min-w-0">
          <span className="stat-number">{total}</span>
          <span className="stat-label">{label}</span>
        </div>
      </div>
      {total ? (
        <>
          <div className="mini-bar mt-2">
            {s.danger ? <span className="seg" style={{ width: pct(s.danger), background: "var(--danger)" }} /> : null}
            {s.warning ? <span className="seg" style={{ width: pct(s.warning), background: "var(--warning)" }} /> : null}
            {s.ok ? <span className="seg" style={{ width: pct(s.ok), background: "var(--success)" }} /> : null}
          </div>
          <div className="stat-legend mt-1">
            {s.danger ? <span className="text-danger">● {compte(s.danger, "danger")}</span> : null}
            {s.warning ? <span className="text-warning">● {compte(s.warning, "warning")}</span> : null}
            {s.ok ? <span className="text-success">● {compte(s.ok, "success")}</span> : null}
          </div>
        </>
      ) : (
        <div className="stat-legend mt-1">
          <span className="text-muted">Aucun élément</span>
        </div>
      )}
    </a>
  );
}

function WidgetBody({ k, d, csrf, canEdit, nonce }: { k: string; d: DashboardData; csrf: string; canEdit: boolean; nonce?: string }) {
  if (k === "conformity") {
    if (!d.totals.total) return null;
    const confColor = d.conformity >= 90 ? "success" : d.conformity >= 70 ? "warning" : "danger";
    return (
      <div className="data-card p-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className={`text-${confColor}`} style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>
              {d.conformity}%
            </div>
            <div>
              <div className="fw-bold">Conformité globale</div>
              <small className="text-muted">
                {d.totals.ok} OK sur {d.totals.total} éléments suivis
              </small>
            </div>
          </div>
          <div className="d-flex gap-2">
            {d.totals.danger ? (
              <a href="/etat/danger" className="badge-status badge-danger text-decoration-none">
                {compte(d.totals.danger, "danger")}
              </a>
            ) : null}
            {d.totals.warning ? (
              <a href="/etat/warning" className="badge-status badge-warning text-decoration-none">
                {compte(d.totals.warning, "warning")}
              </a>
            ) : null}
            <a href="/etat/success" className="badge-status badge-success text-decoration-none">
              {d.totals.ok} OK
            </a>
          </div>
        </div>
        <div className="progress mt-3" style={{ height: 8 }}>
          <div className={`progress-bar bg-${confColor}`} role="progressbar" style={{ width: `${d.conformity}%` }} />
        </div>
      </div>
    );
  }
  if (k === "stats") {
    return (
      <>
        <div className="stat-grid">
          {d.dashCards.map((c) => (
            <Carte key={c.key} c={c} s={c.s} />
          ))}
        </div>
        {d.dashboardCustom ? (
          <div className="stat-tray d-none">
            <div className="stat-tray-title">
              <Icone bi="bi-eye-slash" taille="1em" classes="me-1" />
              Vignettes masquées <small className="text-muted">— cliquez sur l'œil pour réafficher</small>
            </div>
            <div className="stat-tray-items">
              {d.dashHiddenCards.map((c) => (
                <Carte key={c.key} c={c} s={c.s} />
              ))}
              <div className={`stat-tray-empty text-muted small${d.dashHiddenCards.length ? " d-none" : ""}`}>Aucune vignette masquée.</div>
            </div>
          </div>
        ) : null}
      </>
    );
  }
  if (k === "backups_today") {
    if (!d.backups.length) return null;
    const lignes = d.backups.filter((b) => {
      const tc = d.backupChecks.get(b.id);
      return !(tc && tc.status === "ok");
    });
    return (
      <div className="data-card">
        <div className="card-header-custom d-flex justify-content-between align-items-center">
          <h6 className="fw-bold mb-0">
            <Icone bi="bi-cloud-arrow-up" taille="1em" classes="me-2" />
            Sauvegardes de la nuit <span className="text-muted fw-normal ms-1">{dateCourte(d.today)}</span>
          </h6>
          <a href="/backups/daily" className="btn btn-sm btn-outline-success">
            <Icone bi="bi-check2-square" taille="1em" classes="me-1" /> Check complet
          </a>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Service</th>
                <th>Type</th>
                <th>Heure</th>
                <th>Statut du jour</th>
                <th>Commentaire</th>
                <th>Valider</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((backup) => {
                const tc = d.backupChecks.get(backup.id);
                return (
                  <tr key={backup.id}>
                    <td>
                      <a href={`/backups/${backup.id}`} className="fw-medium text-decoration-none">
                        {backup.serviceName}
                      </a>
                    </td>
                    <td>
                      <small>{BACKUP_TYPES[backup.backupType ?? ""] ?? backup.backupType ?? "-"}</small>
                    </td>
                    <td>{backup.expectedTime || "-"}</td>
                    <td>
                      {tc && tc.status === "ok" ? (
                        <span className="badge-status badge-success">
                          <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
                          OK
                        </span>
                      ) : tc && tc.status === "failed" ? (
                        <span className="badge-status badge-danger">
                          <Icone bi="bi-x-circle" taille="1em" classes="me-1" />
                          Échec
                        </span>
                      ) : tc && tc.status === "warning" ? (
                        <span className="badge-status badge-warning">
                          <Icone bi="bi-exclamation-triangle" taille="1em" classes="me-1" />
                          Avertissement
                        </span>
                      ) : (
                        <span className="text-muted">pas encore vérifiée</span>
                      )}
                    </td>
                    {canEdit ? (
                      <>
                        <td>
                          <form id={`qc-${backup.id}`} method="POST" action="/quick-check" className="d-none">
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <input type="hidden" name="backup_id" value={backup.id} />
                          </form>
                          <input type="text" name="comment" form={`qc-${backup.id}`} className="form-control form-control-sm qc-commentaire" placeholder="Commentaire..." style={{ minWidth: 130 }} />
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <button type="submit" form={`qc-${backup.id}`} name="status" value="ok" className="btn btn-sm btn-success fw-medium qc-btn" title="Valider OK">
                              <Icone bi="bi-check-lg" taille="1em" classes="me-1" />
                              OK
                            </button>
                            <button type="submit" form={`qc-${backup.id}`} name="status" value="warning" className="btn btn-sm btn-warning fw-medium qc-btn" title="Marquer en avertissement">
                              <Icone bi="bi-exclamation-triangle" taille="1em" classes="me-1" />
                              Attention
                            </button>
                            <button type="submit" form={`qc-${backup.id}`} name="status" value="failed" className="btn btn-sm btn-danger fw-medium qc-btn" title="Marquer en échec">
                              <Icone bi="bi-x-lg" taille="1em" classes="me-1" />
                              Échec
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td />
                        <td />
                      </>
                    )}
                  </tr>
                );
              })}
              {lignes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-3 text-success">
                    <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
                    Toutes les sauvegardes du jour sont validées.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (k === "attention") {
    const cats = [...new Set(d.urgentItems.map((i) => i.type))];
    return (
      <div className="data-card">
        <div className="card-header-custom d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h6 className="fw-bold mb-0">
            <Icone bi="bi-list-check" taille="1em" classes="me-2" />À traiter <span className="text-muted fw-normal ms-1">{d.urgentItems.length}</span>
          </h6>
          {d.urgentItems.length ? (
            <div id="urgentFilters" className="d-flex flex-wrap gap-1">
              <button type="button" className="status-filter status-filter-secondary active urgent-filter" data-cat="">
                Tous
              </button>
              {cats.map((cat) => (
                <button key={cat} type="button" className="status-filter status-filter-secondary urgent-filter" data-cat={cat}>
                  {CAT_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {d.urgentItems.length ? (
          <>
            <div className="table-responsive">
              <table className="table mb-0 urgent-table" id="urgentList">
                <tbody>
                  {HORIZONS.map(([cle, libelle, couleur]) => {
                    const groupe = d.urgentItems.filter((i) => i.horizon === cle);
                    if (!groupe.length) return null;
                    return (
                      <React.Fragment key={cle}>
                        <tr className="urgent-groupe" data-groupe={cle}>
                          <td colSpan={5}>
                            <span className={`text-${couleur}`}>{libelle}</span> <span className="text-muted">· {groupe.length}</span>
                          </td>
                        </tr>
                        {groupe.map((item) => (
                          <tr key={item.url} className={`urgent-row row-${item.status}`} data-cat={item.type} data-groupe={cle}>
                            <td className="urgent-statut">
                              <StatusBadge status={item.status} />
                            </td>
                            <td className="urgent-icone">
                              <Icone bi={ICONES[item.type] ?? "bi-dot"} taille="1em" classes="text-muted" />
                            </td>
                            <td>
                              <a href={item.url} className="fw-medium text-decoration-none">
                                {item.name}
                              </a>
                            </td>
                            <td className="urgent-detail">
                              {item.days !== null ? <DelaiBadge days={item.days} status={item.status} /> : <span className="text-muted">{item.detail}</span>}
                            </td>
                            <td className="col-actions">
                              {item.action && canEdit ? (
                                <a href={`${item.url}#${item.ancre}`} className="btn btn-sm btn-outline-secondary">
                                  <Icone bi="bi-check-lg" taille="1em" classes="me-1" />
                                  {item.action}
                                </a>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div id="urgentEmpty" className="text-center py-3 text-muted d-none">
              Aucun élément dans cette catégorie.
            </div>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script inline statique. */}
            <script nonce={nonce} dangerouslySetInnerHTML={{ __html: URGENT_FILTER_JS }} />
          </>
        ) : (
          <div className="text-center py-4 text-muted">
            <Icone bi="bi-check-circle" taille="1em" classes="text-success" style="font-size: 2rem;" />
            <p className="mt-2 mb-0">Rien à traiter : tout est en ordre.</p>
          </div>
        )}
      </div>
    );
  }
  if (k === "upcoming") {
    return (
      <div className="data-card">
        <div className="card-header-custom d-flex justify-content-between align-items-center">
          <h6 className="fw-bold mb-0">
            <Icone bi="bi-calendar-event" taille="1em" classes="me-2" />À venir
          </h6>
          <a href="/agenda" className="btn btn-sm btn-outline-primary">
            Voir tout <Icone bi="bi-arrow-right" taille="1em" classes="ms-1" />
          </a>
        </div>
        <div className="p-3">
          {d.upcoming.length ? (
            d.upcoming.map((u) => (
              <a key={u.url + u.label} href={u.url} className="text-decoration-none d-flex justify-content-between align-items-center gap-2 py-2 border-bottom">
                <span className="text-truncate">
                  <Icone bi={u.icon} taille={14} classes="me-2 text-muted" />
                  {u.label}
                </span>
                <span className="flex-shrink-0 small">
                  <DelaiBadge days={u.days} status={u.days <= 7 ? "danger" : u.days <= 15 ? "warning" : "info"} />
                </span>
              </a>
            ))
          ) : (
            <p className="text-muted text-center mb-0 py-2">Rien dans les 60 prochains jours.</p>
          )}
        </div>
      </div>
    );
  }
  if (k === "alerts") {
    return (
      <div className="data-card">
        <div className="card-header-custom d-flex justify-content-between align-items-center">
          <h6 className="fw-bold mb-0">
            <Icone bi="bi-bell" taille="1em" classes="me-2" />
            Dernières alertes envoyées
          </h6>
          <a href="/alerts" className="btn btn-sm btn-outline-primary">
            Voir tout <Icone bi="bi-arrow-right" taille="1em" classes="ms-1" />
          </a>
        </div>
        <div className="p-3">
          {d.recentAlerts.length ? (
            d.recentAlerts.map((alert) => (
              <div key={alert.id} className="d-flex align-items-start gap-2 mb-3 pb-3 border-bottom">
                <Icone bi={alert.status === "sent" ? "bi-envelope-check" : "bi-envelope"} taille="1em" classes={alert.status === "sent" ? "text-success" : "text-danger"} />
                <div>
                  <small className="fw-medium d-block">{alert.entityName || "Systeme"}</small>
                  <small className="text-muted">{`${dateCourte(alert.sentAt)} ${alert.sentAt.toISOString().slice(11, 16)}`}</small>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted text-center mb-0 py-3">Aucune alerte envoyee</p>
          )}
        </div>
      </div>
    );
  }
  return null;
}

import React from "react";

export default async function DashboardPage() {
  const page = await contextePage();
  const d = await dashboardData(page.user);
  const meta = new Map(DASHBOARD_WIDGETS.map((w) => [w.key, w]));
  const canEdit = page.user.canEdit();
  const sousTitre = (() => {
    const bouts: string[] = [];
    if (d.urgentItems.length) bouts.push(`${d.urgentItems.length} échéance${d.urgentItems.length > 1 ? "s" : ""} à traiter`);
    if (d.backupsAValider) bouts.push(`${d.backupsAValider} sauvegarde${d.backupsAValider > 1 ? "s" : ""} à valider`);
    return bouts.length ? ` · ${bouts.join(", ")}` : " · rien à traiter";
  })();
  const jourLong = dateLongue(d.today);
  const Widget = ({ k }: { k: string }) => {
    const m = meta.get(k);
    if (!m) return null;
    return (
      <section className="dash-widget" data-widget={k} style={{ "--w-span": d.dashSpans[k] } as React.CSSProperties}>
        <div className="dash-widget-bar">
          <span className="dash-drag" title="Glisser pour déplacer" aria-hidden="true">
            <Icone bi="bi-grip-vertical" taille="1em" />
          </span>
          <span className="dash-widget-name">
            <Icone bi={m.icon} taille={14} classes="me-1" />
            {m.label}
          </span>
          <button type="button" className="dash-toggle" data-widget={k} title="Masquer / afficher ce bloc">
            <Icone bi="bi-eye-slash" taille="1em" />
          </button>
        </div>
        <div className="dash-widget-body">
          <WidgetBody k={k} d={d} csrf={page.csrf} canEdit={canEdit} nonce={page.nonce} />
        </div>
        <span className="dash-resize" title="Redimensionner (largeur)" aria-hidden="true" />
      </section>
    );
  };
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">
            {jourLong.charAt(0).toUpperCase() + jourLong.slice(1)}
            {sousTitre}
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          {d.dashboardCustom ? (
            <>
              <div id="dashEditControls" className="d-flex gap-2 align-items-center d-none">
                <button type="button" id="dashResetBtn" className="btn btn-sm btn-outline-secondary" title="Rétablir la disposition par défaut">
                  <Icone bi="bi-arrow-counterclockwise" taille="1em" classes="me-1" /> Réinitialiser
                </button>
                <button type="button" id="dashDoneBtn" className="btn btn-sm btn-success">
                  <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> Terminer
                </button>
              </div>
              <button type="button" id="dashCustomizeBtn" className="btn btn-sm btn-outline-primary" title="Choisir et réorganiser les blocs">
                <Icone bi="bi-sliders" taille="1em" classes="me-1" /> Personnaliser
              </button>
            </>
          ) : null}
          <a href="/rapport.pdf" className="btn btn-sm btn-outline-danger" title="Bilan PDF (COPIL)">
            <Icone bi="bi-file-earmark-pdf" taille="1em" classes="me-1" /> Bilan PDF
          </a>
        </div>
      </div>

      {d.dashboardCustom ? (
        <div id="dashTray" className="dash-tray d-none">
          <div className="dash-tray-title">
            <Icone bi="bi-eye-slash" taille="1em" classes="me-1" />
            Blocs masqués <small className="text-muted">— cliquez sur l'œil pour réafficher</small>
          </div>
          <div id="dashTrayItems" className="dash-tray-items">
            {d.dashHidden.map((k) => (
              <Widget key={k} k={k} />
            ))}
            <div id="dashTrayEmpty" className={`text-muted small${d.dashHidden.length ? " d-none" : ""}`}>
              Aucun bloc masqué.
            </div>
          </div>
        </div>
      ) : null}

      <div id="dashGrid" className="dash-grid" data-save-url="/dashboard/layout" data-csrf={page.csrf}>
        {d.dashVisible.map((k) => (
          <Widget key={k} k={k} />
        ))}
      </div>

      {d.dashboardCustom ? <script src="/js/dashboard-custom.js" nonce={page.nonce} /> : null}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script inline statique. */}
      <script nonce={page.nonce} dangerouslySetInnerHTML={{ __html: TOOLTIP_JS }} />
    </>
  );
}
