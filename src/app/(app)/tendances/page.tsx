import { Icone } from "@/components/icones";
import { ScriptDiffere } from "@/components/scripts";
import { aujourdhui } from "@/lib/libelles";
import { prisma } from "@/server/db";
import { chargerTout } from "@/server/donnees";
import { contextePage } from "@/server/page";

export const metadata = { title: "Tendances - Sentinelle" };

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** trends.html */
export default async function Tendances() {
  const page = await contextePage();
  const { user, nonce } = page;
  const today = aujourdhui();
  const days: Date[] = [];
  for (let i = 29; i >= 0; i--) days.push(new Date(today.getTime() - i * 86_400_000));
  const labels = days.map(
    (d) =>
      `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
  );

  const backups = { ok: [] as number[], warning: [] as number[], failed: [] as number[] };
  const showBackups = user.canView("backups");
  if (showBackups) {
    const rows = await prisma.backupCheck.findMany({
      where: { checkDate: { gte: days[0] } },
      select: { checkDate: true, status: true, firstStatus: true },
    });
    const perDay = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const k = iso(r.checkDate);
      const st = r.firstStatus || r.status;
      const m = perDay.get(k) ?? {};
      m[st] = (m[st] ?? 0) + 1;
      perDay.set(k, m);
    }
    for (const d of days) {
      const counts = perDay.get(iso(d)) ?? {};
      backups.ok.push(counts.ok ?? 0);
      backups.warning.push(counts.warning ?? 0);
      backups.failed.push(counts.failed ?? 0);
    }
  }

  let alerts: number[] = [];
  const showAlerts = user.canView("alerts");
  if (showAlerts) {
    const rows = await prisma.alertLog.findMany({
      where: { status: "sent", sentAt: { gte: days[0] } },
      select: { sentAt: true },
    });
    const perDay = new Map<string, number>();
    for (const r of rows) {
      const k = iso(r.sentAt);
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    alerts = days.map((d) => perDay.get(iso(d)) ?? 0);
  }

  const tout = await chargerTout();
  const dist = { danger: 0, warning: 0, info: 0, success: 0 };
  const sources: [string, { status: string }[]][] = [
    ["accounts", tout.accounts],
    ["certificates", tout.certificates],
    ["domains", tout.domains],
    ["backups", tout.backups],
    ["tests", tout.tests],
    ["reviews", tout.reviews],
    ["updates", tout.updates],
  ];
  for (const [cat, rows] of sources) {
    if (!user.canView(cat)) continue;
    for (const o of rows) if (o.status in dist) dist[o.status as keyof typeof dist] += 1;
  }

  const total = dist.danger + dist.warning + dist.info + dist.success;
  const conformity = total ? Math.round((dist.success / total) * 100) : 0;
  const confColor = conformity >= 90 ? "success" : conformity >= 70 ? "warning" : "danger";
  const alertsTotal = alerts.reduce((a, b) => a + b, 0);
  const bOk = backups.ok.reduce((a, b) => a + b, 0);
  const bWarn = backups.warning.reduce((a, b) => a + b, 0);
  const bFail = backups.failed.reduce((a, b) => a + b, 0);
  const bTot = bOk + bWarn + bFail;
  const bRate = bTot ? Math.round((bOk / bTot) * 100) : 0;

  const js = `
const LABELS = ${JSON.stringify(labels)};
const STATUS = {danger: '#ef4444', warning: '#f59e0b', info: '#3b82f6', success: '#10b981'};
const BY_STATUS = {danger: "/etat/danger", warning: "/etat/warning", info: "/etat/info", success: "/etat/success"};
const ALERTS_URL = "/alerts";
const BACKUPS_URL = "/backups";
const DOUGHNUT_STATUS = ['danger', 'warning', 'info', 'success'];

function pointerOnHover(e, els) {
    if (e && e.native && e.native.target) e.native.target.style.cursor = els.length ? 'pointer' : 'default';
}
let trendCharts = [];

function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + a + ')';
}

function buildCharts() {
    trendCharts.forEach(c => c.destroy());
    trendCharts = [];

    const tick = cssVar('--text-light', '#94a3b8');
    const grid = hexToRgba('#94a3b8', 0.18);
    const cardBg = cssVar('--card-bg', '#ffffff');

    Chart.defaults.color = tick;
    Chart.defaults.font.family = cssVar('--font-sans', 'system-ui, sans-serif');
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.boxPadding = 4;

    const distEl = document.getElementById('chartDist');
    if (distEl) {
        trendCharts.push(new Chart(distEl, {
            type: 'doughnut',
            data: {
                labels: ['Critique', 'Urgent', 'À prévoir', 'OK'],
                datasets: [{
                    data: [${dist.danger}, ${dist.warning}, ${dist.info}, ${dist.success}],
                    backgroundColor: [STATUS.danger, STATUS.warning, STATUS.info, STATUS.success],
                    borderColor: cardBg,
                    borderWidth: 3,
                    hoverOffset: 8,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '66%',
                onHover: pointerOnHover,
                onClick: function (e, els) {
                    if (els.length) window.location = BY_STATUS[DOUGHNUT_STATUS[els[0].index]];
                },
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, boxWidth: 8 } }
                }
            }
        }));
    }
${
  showAlerts
    ? `
    const alertsEl = document.getElementById('chartAlerts');
    if (alertsEl) {
        const ctx = alertsEl.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 280);
        grad.addColorStop(0, hexToRgba(STATUS.danger, 0.28));
        grad.addColorStop(1, hexToRgba(STATUS.danger, 0));
        trendCharts.push(new Chart(alertsEl, {
            type: 'line',
            data: { labels: LABELS, datasets: [{
                label: 'Alertes', data: ${JSON.stringify(alerts)},
                borderColor: STATUS.danger, backgroundColor: grad,
                fill: true, tension: 0.35, borderWidth: 2.5,
                pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: STATUS.danger,
            }]},
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                onHover: pointerOnHover,
                onClick: function () { window.location = ALERTS_URL; },
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 10, autoSkip: true } },
                    y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid, drawBorder: false } }
                }
            }
        }));
    }`
    : ""
}
${
  showBackups
    ? `
    const backupsEl = document.getElementById('chartBackups');
    if (backupsEl) {
        trendCharts.push(new Chart(backupsEl, {
            type: 'bar',
            data: { labels: LABELS, datasets: [
                { label: 'OK', data: ${JSON.stringify(backups.ok)}, backgroundColor: STATUS.success, borderRadius: 4, maxBarThickness: 18 },
                { label: 'Warning', data: ${JSON.stringify(backups.warning)}, backgroundColor: STATUS.warning, borderRadius: 4, maxBarThickness: 18 },
                { label: 'Échec', data: ${JSON.stringify(backups.failed)}, backgroundColor: STATUS.danger, borderRadius: 4, maxBarThickness: 18 },
            ]},
            options: {
                responsive: true, maintainAspectRatio: false,
                onHover: pointerOnHover,
                onClick: function () { window.location = BACKUPS_URL; },
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, boxWidth: 8 } } },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 12, autoSkip: true } },
                    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: grid, drawBorder: false } }
                }
            }
        }));
    }`
    : ""
}
}

document.addEventListener('DOMContentLoaded', buildCharts);
// Redessine les graphiques quand le thème change (clair/sombre)
new MutationObserver(buildCharts).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
`;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h1 className="page-title">Tendances</h1>
          <p className="page-subtitle">
            Évolution sur les 30 derniers jours · <Icone bi="bi-hand-index" taille="1em" /> cliquez
            sur un graphique pour ouvrir la liste correspondante
          </p>
        </div>
        <a href="/" className="btn btn-sm btn-outline-secondary">
          <Icone bi="bi-grid-1x2" taille="1em" classes="me-1" /> Tableau de bord
        </a>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="stat-card">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted d-block">Éléments suivis</small>
                <span className="stat-number">{total}</span>
              </div>
              <div className="stat-icon bg-primary bg-opacity-10 text-primary">
                <Icone bi="bi-collection" taille="1em" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="stat-card">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <small className="text-muted d-block">Conformité globale</small>
                <span className={`stat-number text-${confColor}`}>{conformity}%</span>
              </div>
              <div className={`stat-icon bg-${confColor} bg-opacity-10 text-${confColor}`}>
                <Icone bi="bi-shield-check" taille="1em" />
              </div>
            </div>
            <div className="progress mt-2" style={{ height: 6 }}>
              <div className={`progress-bar bg-${confColor}`} style={{ width: `${conformity}%` }} />
            </div>
          </div>
        </div>
        {showAlerts ? (
          <div className="col-sm-6 col-lg-3">
            <div className="stat-card">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <small className="text-muted d-block">Alertes (30 j)</small>
                  <span className="stat-number text-danger">{alertsTotal}</span>
                </div>
                <div className="stat-icon bg-danger bg-opacity-10 text-danger">
                  <Icone bi="bi-bell" taille="1em" />
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {showBackups ? (
          <div className="col-sm-6 col-lg-3">
            <div className="stat-card">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <small className="text-muted d-block">Backups réussis (30 j)</small>
                  <span className="stat-number text-success">{bRate}%</span>
                </div>
                <div className="stat-icon bg-success bg-opacity-10 text-success">
                  <Icone bi="bi-cloud-check" taille="1em" />
                </div>
              </div>
              <small className="text-muted">
                {bOk} OK · {bWarn} warn · {bFail} échec
              </small>
            </div>
          </div>
        ) : null}
      </div>

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="data-card h-100">
            <div className="card-header-custom">
              <h6 className="fw-bold mb-0">
                <Icone bi="bi-pie-chart" taille="1em" classes="me-2 text-primary" />
                Répartition par statut
              </h6>
            </div>
            <div className="p-3">
              {total ? (
                <div style={{ position: "relative", height: 280 }}>
                  <canvas id="chartDist" />
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <Icone bi="bi-inbox" taille="1em" style="font-size: 2rem;" />
                  <p className="mb-0 mt-2">Aucun élément suivi pour le moment.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {showAlerts ? (
          <div className="col-lg-7">
            <div className="data-card h-100">
              <div className="card-header-custom">
                <h6 className="fw-bold mb-0">
                  <Icone bi="bi-activity" taille="1em" classes="me-2 text-danger" />
                  Alertes envoyées par jour
                </h6>
              </div>
              <div className="p-3">
                <div style={{ position: "relative", height: 280 }}>
                  <canvas id="chartAlerts" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showBackups ? (
          <div className="col-12">
            <div className="data-card">
              <div className="card-header-custom">
                <h6 className="fw-bold mb-0">
                  <Icone bi="bi-bar-chart" taille="1em" classes="me-2 text-info" />
                  Checks de backup par jour
                </h6>
              </div>
              <div className="p-3">
                <div style={{ position: "relative", height: 240 }}>
                  <canvas id="chartBackups" />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ScriptDiffere src="/vendor/chart.umd.min.js" nonce={nonce} />
      <ScriptDiffere code={js} nonce={nonce} />
    </>
  );
}
