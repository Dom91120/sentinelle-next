import { Icone } from "@/components/icones";
import { aujourdhui } from "@/lib/libelles";
import { backupStreak, backupSuccessRate } from "@/lib/statuts";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Statistiques Backups - Sentinelle" };

function taux(rate: number | null): string {
  if (rate === null) return "text-muted";
  if (rate >= 95) return "text-success";
  if (rate >= 80) return "text-warning";
  return "text-danger";
}

/** backups/stats.html */
export default async function BackupsStats() {
  await contexteModule("backups");
  const today = aujourdhui();
  const windowStart = new Date(today.getTime() - 29 * 86_400_000);
  const [backups, recentRows, allRows] = await Promise.all([
    prisma.backup.findMany({ where: { isActive: true } }),
    prisma.backupCheck.findMany({ where: { checkDate: { gte: windowStart } } }),
    prisma.backupCheck.findMany(),
  ]);
  const recent = new Map<number, Map<string, (typeof recentRows)[number]>>();
  for (const c of recentRows) {
    if (!recent.has(c.backupId)) recent.set(c.backupId, new Map());
    recent.get(c.backupId)?.set(c.checkDate.toISOString().slice(0, 10), c);
  }
  const allByBackup = new Map<number, typeof allRows>();
  for (const c of allRows) {
    if (!allByBackup.has(c.backupId)) allByBackup.set(c.backupId, []);
    allByBackup.get(c.backupId)?.push(c);
  }
  const fs = (c: { firstStatus: string | null; status: string }) => c.firstStatus || c.status;
  const statsData = backups.map((b) => {
    const checks = allByBackup.get(b.id) ?? [];
    const calendar = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      const c = recent.get(b.id)?.get(iso);
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      calendar.push({
        date: iso,
        dateDisplay: `${dd}/${mm}`,
        status: c ? c.firstStatus || c.status : null,
        recovered: Boolean(c?.firstStatus && c.firstStatus !== c.status && c.status === "ok"),
        comment: c?.comment ?? null,
      });
    }
    return {
      backup: b,
      rate30: backupSuccessRate(checks, 30),
      rate7: backupSuccessRate(checks, 7),
      streak: backupStreak(checks),
      totalOk: checks.filter((c) => fs(c) === "ok").length,
      totalFailed: checks.filter((c) => fs(c) === "failed").length,
      totalWarning: checks.filter((c) => fs(c) === "warning").length,
      calendar,
    };
  });
  const globalOk = statsData.reduce((a, s) => a + s.totalOk, 0);
  const globalFailed = statsData.reduce((a, s) => a + s.totalFailed, 0);
  const globalWarning = statsData.reduce((a, s) => a + s.totalWarning, 0);
  const globalTotal = globalOk + globalFailed + globalWarning;
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">Statistiques des sauvegardes</h1>
          <p className="page-subtitle">Vue globale sur les 30 derniers jours</p>
        </div>
        <a href="/backups" className="btn btn-outline-secondary">
          <Icone bi="bi-arrow-left" taille="1em" classes="me-1" /> Retour
        </a>
      </div>

      <div className="row g-3 mb-4">
        {[
          ["Total checks", globalTotal, "text-primary"],
          ["Reussis", globalOk, "text-success"],
          ["Warnings", globalWarning, "text-warning"],
          ["Echoues", globalFailed, "text-danger"],
        ].map(([label, n, cls]) => (
          <div className="col-md-3" key={String(label)}>
            <div className="stat-card text-center">
              <small className="text-muted d-block">{label}</small>
              <span className={`stat-number ${cls}`}>{n}</span>
            </div>
          </div>
        ))}
      </div>

      {statsData.length ? (
        statsData.map((item) => (
          <div className="data-card mb-4" key={item.backup.id}>
            <div className="card-header-custom d-flex justify-content-between align-items-center">
              <div>
                <h6 className="fw-bold mb-0">
                  <a href={`/backups/${item.backup.id}`} className="text-decoration-none">
                    {item.backup.serviceName}
                  </a>
                </h6>
                <small className="text-muted">
                  {item.backup.backupType || ""} - {item.backup.location || ""}
                </small>
              </div>
              <div className="d-flex gap-3 align-items-center">
                <div className="text-center">
                  <small className="text-muted d-block">Taux 30j</small>
                  <span className={`fw-bold ${taux(item.rate30)}`}>
                    {item.rate30 !== null ? `${item.rate30.toFixed(1)}%` : "-"}
                  </span>
                </div>
                <div className="text-center">
                  <small className="text-muted d-block">Taux 7j</small>
                  <span className={`fw-bold ${taux(item.rate7)}`}>
                    {item.rate7 !== null ? `${item.rate7.toFixed(1)}%` : "-"}
                  </span>
                </div>
                <div className="text-center">
                  <small className="text-muted d-block">Serie en cours</small>
                  <span className="fw-bold text-success">{item.streak}j</span>
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="d-flex gap-1 flex-wrap">
                {item.calendar.map((day) => (
                  <div
                    className="text-center"
                    style={{ width: 28 }}
                    key={day.date}
                    title={`${day.dateDisplay}${day.recovered ? " - incident corrige (repasse OK)" : ""}${day.comment ? ` - ${day.comment}` : ""}`}
                  >
                    <div
                      className={`heat-cell heat-${day.status && ["ok", "failed", "warning"].includes(day.status) ? day.status : "empty"}${day.recovered ? " heat-recovered" : ""}`}
                    />
                    <small className="text-muted" style={{ fontSize: "0.55rem" }}>
                      {day.dateDisplay}
                    </small>
                  </div>
                ))}
              </div>
              <div className="d-flex gap-3 mt-2 flex-wrap">
                <small>
                  <span className="heat-swatch heat-ok" /> OK
                </small>
                <small>
                  <span className="heat-swatch heat-warning" /> Warning
                </small>
                <small>
                  <span className="heat-swatch heat-failed" /> Echoue
                </small>
                <small>
                  <span className="heat-swatch heat-empty" /> Non verifie
                </small>
                <small>
                  <span className="heat-swatch heat-failed heat-recovered" /> Incident corrige
                </small>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="data-card p-4 text-center text-muted">
          <Icone bi="bi-bar-chart" taille="1em" style="font-size: 2rem;" />
          <p className="mt-2 mb-0">Aucune donnee de backup disponible</p>
        </div>
      )}
    </>
  );
}
