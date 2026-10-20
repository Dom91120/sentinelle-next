import { Icone } from "@/components/icones";
import { Barre, Cellule, CsvToolbar, PaginationBar, Vide } from "@/components/liste";
import { StatusBadge } from "@/components/macros";
import { statusRank } from "@/lib/constantes";
import { backupSuccessRate, backupTodayCheck } from "@/lib/statuts";
import { BACKUP_TYPE_LABELS, FREQ_LABELS } from "@/modules/backups/server";
import { chargerSauvegardes } from "@/server/donnees";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Sauvegardes - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** backups/list.html */
export default async function BackupsList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("backups");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  let backups = await chargerSauvegardes();
  backups = textSearch(backups, q, ["serviceName", "location", "backupType", "description"]);
  backups.sort((a, b) => statusRank(a.status) - statusRank(b.status));
  const perPage = await resolvePerPage(params, page.user, "backups.list");
  const [rows, p] = paginate(backups, params, perPage);
  const { user, csrf } = page;
  const peutEditer = user.canEdit("backups");
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Sauvegardes <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">Les sauvegardes à vérifier chaque jour, et leur taux de réussite</p>
        </div>
        <div className="page-actions">
          {peutEditer ? (
            <a href="/backups/daily" className="btn btn-outline-secondary">
              <Icone bi="bi-check2-square" taille="1em" classes="me-1" /> Check quotidien
            </a>
          ) : null}
          <a href="/backups/stats" className="btn btn-outline-secondary">
            <Icone bi="bi-bar-chart" taille="1em" classes="me-1" /> Statistiques
          </a>
          {user.settings.BACKUP_INBOX_DIR && peutEditer ? (
            <form method="POST" action="/backups/scan-inbox" className="d-inline">
              <input type="hidden" name="csrf_token" value={csrf} />
              <button type="submit" className="btn btn-outline-secondary" title="Lire les mails de sauvegarde du répertoire">
                <Icone bi="bi-envelope-arrow-down" taille="1em" classes="me-1" /> Scanner la boîte
              </button>
            </form>
          ) : null}
          <CsvToolbar csvKey="backups" canEdit={peutEditer} csrf={csrf} />
          {peutEditer ? (
            <a href="/backups/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouvelle sauvegarde
            </a>
          ) : null}
        </div>
      </div>

      <Barre q={q} pathname={page.pathname} search={page.search} />

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 js-filterable">
            <thead>
              <tr>
                <th>Service</th>
                <th>Aujourd'hui</th>
                <th>Planification</th>
                <th>Réussite 30 j</th>
                <th>Emplacement</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((backup) => {
                  const tc = backupTodayCheck(backup.checks);
                  const rate = backupSuccessRate(backup.checks, 30);
                  return (
                    <tr key={backup.id} className={`row-${backup.status}`}>
                      <td>
                        <a href={`/backups/${backup.id}`} className="fw-medium text-decoration-none">
                          {backup.serviceName}
                        </a>
                        <small className="d-block text-muted">{BACKUP_TYPE_LABELS[backup.backupType ?? ""] ?? backup.backupType ?? ""}</small>
                      </td>
                      <td>
                        {tc ? (
                          tc.status === "ok" ? (
                            <span className="text-success">
                              <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
                              OK
                            </span>
                          ) : tc.status === "failed" ? (
                            <span className="text-danger">
                              <Icone bi="bi-x-circle" taille="1em" classes="me-1" />
                              Échec
                            </span>
                          ) : (
                            <span className="text-warning">
                              <Icone bi="bi-exclamation-triangle" taille="1em" classes="me-1" />
                              Avertissement
                            </span>
                          )
                        ) : (
                          <span className="text-muted">non vérifiée</span>
                        )}
                      </td>
                      <td>
                        <Cellule principal={FREQ_LABELS[backup.frequency ?? ""] ?? backup.frequency ?? "—"} secondaire={backup.expectedTime ? `à ${backup.expectedTime}` : ""} />
                      </td>
                      <td>
                        {rate !== null ? <span className={`fw-bold ${rate >= 95 ? "text-success" : rate >= 80 ? "text-warning" : "text-danger"}`}>{rate} %</span> : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        <small>{backup.location || "—"}</small>
                      </td>
                      <td>
                        <StatusBadge status={backup.status} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <Vide colonnes={6} message="Aucune sauvegarde." urlAjout={peutEditer ? "/backups/create" : null} />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
