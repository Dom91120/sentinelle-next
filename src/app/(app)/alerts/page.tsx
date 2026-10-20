import { Icone } from "@/components/icones";
import { dateHeure } from "@/lib/libelles";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";

export const metadata = { title: "Alertes - Sentinelle" };

/** alerts/list.html */
export default async function AlertsList() {
  await contexteModule("alerts");
  const alerts = await prisma.alertLog.findMany({ orderBy: { sentAt: "desc" }, take: 100 });
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alertes envoyées</h1>
          <p className="page-subtitle">Historique des notifications envoyées par mail</p>
        </div>
      </div>

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Entite</th>
                <th>Message</th>
                <th>Destinataires</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length ? (
                alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>{dateHeure(alert.sentAt)}</td>
                    <td>{alert.alertType}</td>
                    <td>
                      {alert.entityType ? (
                        <>
                          <span className="badge bg-light text-dark border">
                            {alert.entityType}
                          </span>{" "}
                          {alert.entityName ?? ""}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <small>
                        {(alert.message ?? "").slice(0, 100)}
                        {(alert.message ?? "").length > 100 ? "..." : ""}
                      </small>
                    </td>
                    <td>
                      <small>{alert.recipients}</small>
                    </td>
                    <td>
                      {alert.status === "sent" ? (
                        <span className="badge-status badge-success">
                          <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
                          Envoyée
                        </span>
                      ) : (
                        <span className="badge-status badge-danger">
                          <Icone bi="bi-x-circle" taille="1em" classes="me-1" />
                          Échouée
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    <Icone bi="bi-bell-slash" taille="1em" style="font-size: 2rem;" />
                    <p className="mt-2 mb-0">Aucune alerte envoyée</p>
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
