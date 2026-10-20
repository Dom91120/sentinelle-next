import { Icone } from "@/components/icones";
import { aujourdhui, dateLongue } from "@/lib/libelles";
import { BACKUP_TYPE_LABELS_PLAIN } from "@/modules/backups/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Check quotidien - Sentinelle" };

/** backups/daily.html */
export default async function BackupsDaily() {
  const page = await contexteModule("backups");
  await requireEdit("backups");
  const today = aujourdhui();
  const [backups, rows] = await Promise.all([
    prisma.backup.findMany({ where: { isActive: true }, orderBy: { serviceName: "asc" } }),
    prisma.backupCheck.findMany({ where: { checkDate: today } }),
  ]);
  const checks = new Map(rows.map((c) => [c.backupId, c]));
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">Check quotidien</h1>
          <p className="page-subtitle">{dateLongue(today)}</p>
        </div>
        <a href="/backups" className="btn btn-outline-secondary">
          <Icone bi="bi-arrow-left" taille="1em" classes="me-1" /> Retour
        </a>
      </div>

      <form method="POST">
        <input type="hidden" name="csrf_token" value={page.csrf} />
        <div className="data-card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>Service</th>
                  <th style={{ width: "15%" }}>Type</th>
                  <th style={{ width: "10%" }}>Heure</th>
                  <th style={{ width: "20%" }}>Statut du jour</th>
                  <th style={{ width: "35%" }}>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {backups.length ? (
                  backups.map((backup) => {
                    const existing = checks.get(backup.id);
                    return (
                      <tr key={backup.id}>
                        <td>
                          <a href={`/backups/${backup.id}`} className="fw-medium text-decoration-none">
                            {backup.serviceName}
                          </a>
                          {backup.location ? (
                            <>
                              <br />
                              <small className="text-muted">{backup.location}</small>
                            </>
                          ) : null}
                        </td>
                        <td>
                          <small>{BACKUP_TYPE_LABELS_PLAIN[backup.backupType ?? ""] ?? backup.backupType ?? "-"}</small>
                        </td>
                        <td>{backup.expectedTime || "-"}</td>
                        <td>
                          <select name={`status_${backup.id}`} className="form-select form-select-sm" defaultValue={existing?.status ?? ""}>
                            <option value="">-- Non verifie --</option>
                            <option value="ok">OK</option>
                            <option value="warning">Warning</option>
                            <option value="failed">Echoue</option>
                          </select>
                        </td>
                        <td>
                          <input type="text" name={`comment_${backup.id}`} className="form-control form-control-sm" defaultValue={existing?.comment ?? ""} placeholder="Commentaire si probleme..." />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      <Icone bi="bi-inbox" taille="1em" style="font-size: 2rem;" />
                      <p className="mt-2 mb-0">
                        Aucun backup configure.{" "}
                        <a href="/backups/create" className="btn btn-sm btn-primary mt-1">
                          <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Ajouter le premier
                        </a>
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {backups.length ? (
          <div className="mt-3 d-flex justify-content-end">
            <button type="submit" className="btn btn-success btn-lg">
              <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> Enregistrer les checks
            </button>
          </div>
        ) : null}
      </form>
    </>
  );
}
