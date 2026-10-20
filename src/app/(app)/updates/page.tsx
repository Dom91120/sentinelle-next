import { Icone } from "@/components/icones";
import { Barre, CsvToolbar, PaginationBar, Vide } from "@/components/liste";
import { statusRank } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { updateStatusColor } from "@/lib/statuts";
import { STATUS_LABELS, TYPE_LABELS } from "@/modules/updates/server";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Mises à jour - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** updates/list.html */
export default async function UpdatesList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("updates");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  let updates = (
    await prisma.systemUpdate.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
  ).map((u) => ({ ...u, couleur: updateStatusColor(u) }));
  updates = textSearch(updates, q, [
    "name",
    "currentVersion",
    "latestVersion",
    "updatedBy",
    "description",
  ]);
  updates.sort((a, b) => statusRank(a.couleur) - statusRank(b.couleur));
  const perPage = await resolvePerPage(params, page.user, "updates.list");
  const [rows, p] = paginate(updates, params, perPage);
  const { user, csrf } = page;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Mises à jour <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            Versions des applications et systèmes suivis, et ce qui attend une mise à jour
          </p>
        </div>
        <div className="page-actions">
          <CsvToolbar csvKey="updates" canEdit={user.canEdit("updates")} csrf={csrf} />
          {user.canEdit("updates") ? (
            <a href="/updates/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouveau suivi
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
                <th>Application</th>
                <th>Version actuelle</th>
                <th>Dernière version</th>
                <th>Dernière mise à jour</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((u) => (
                  <tr key={u.id} className={`row-${u.couleur}`}>
                    <td>
                      <a href={`/updates/${u.id}`} className="fw-medium text-decoration-none">
                        {u.name}
                      </a>
                      <small className="d-block text-muted">
                        {TYPE_LABELS[u.systemType ?? ""] ?? u.systemType}
                      </small>
                    </td>
                    <td>
                      <code>{u.currentVersion || "—"}</code>
                    </td>
                    <td>
                      <code>{u.latestVersion || "—"}</code>
                    </td>
                    <td>{u.lastUpdate ? dateCourte(u.lastUpdate) : "—"}</td>
                    <td>
                      <span className={`badge-status badge-${u.couleur}`}>
                        {STATUS_LABELS[u.status ?? ""] ?? u.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={6}
                  message="Aucune application ni système suivi."
                  urlAjout={user.canEdit("updates") ? "/updates/create" : null}
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
