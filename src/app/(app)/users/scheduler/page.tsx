import { Icone } from "@/components/icones";
import { dateHeure } from "@/lib/libelles";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { prochaineExecution, tachesActives } from "@/server/jobs-registre";
import { contextePage } from "@/server/page";

export const metadata = { title: "Tâches planifiées - Sentinelle" };

function heureSecondes(d: Date): string {
  return `${dateHeure(d)}:${String(d.getSeconds()).padStart(2, "0")}`;
}

/** users/scheduler.html */
export default async function Scheduler() {
  const page = await contextePage();
  await requireAdmin();
  const now = new Date();
  const jobs = tachesActives(page.user.settings)
    .map((t) => ({ id: t.id, next: prochaineExecution(t, now) }))
    .sort((a, b) => a.next.getTime() - b.next.getTime());
  const runs = await prisma.schedulerRun.findMany({ orderBy: { runAt: "desc" }, take: 100 });
  // Le planificateur est le conteneur cron : « actif » si un job a tourné dans les 26 dernières heures.
  const running = runs.length > 0 && now.getTime() - runs[0].runAt.getTime() < 26 * 3_600_000;
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">Tâches planifiées</h1>
          <p className="page-subtitle">Planificateur : {running ? <span className="text-success">actif</span> : <span className="text-danger">arrêté</span>}</p>
        </div>
        <a href="/users" className="btn btn-outline-secondary">
          <Icone bi="bi-people" taille="1em" classes="me-1" /> Utilisateurs
        </a>
      </div>

      <div className="data-card mb-4">
        <div className="card-header-custom">
          <h6 className="fw-bold mb-0">Prochaines exécutions</h6>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Tâche</th>
                <th>Prochaine exécution</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length ? (
                jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <code>{j.id}</code>
                    </td>
                    <td>{dateHeure(j.next)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="text-center py-3 text-muted">
                    Aucune tâche planifiée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="data-card">
        <div className="card-header-custom">
          <h6 className="fw-bold mb-0">Dernières exécutions</h6>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tâche</th>
                <th>Statut</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {runs.length ? (
                runs.map((r) => (
                  <tr key={r.id} className={r.status === "error" ? "row-danger" : undefined}>
                    <td style={{ width: 160, whiteSpace: "nowrap" }}>{heureSecondes(r.runAt)}</td>
                    <td>
                      <code>{r.jobId}</code>
                    </td>
                    <td>{r.status === "error" ? <span className="badge-status badge-danger">Erreur</span> : <span className="badge-status badge-success">OK</span>}</td>
                    <td className="text-muted">{r.message || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-3 text-muted">
                    Aucune exécution enregistrée pour le moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
