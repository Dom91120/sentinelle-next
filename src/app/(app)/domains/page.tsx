import { Icone } from "@/components/icones";
import { Barre, Cellule, CsvToolbar, PaginationBar, Vide } from "@/components/liste";
import { DelaiBadge, StatusBadge } from "@/components/macros";
import { statusRank } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { chargerDomaines } from "@/server/donnees";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Domaines - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** domains/list.html */
export default async function DomainsList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("domains");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  let domains = await chargerDomaines();
  // Domain.expiry_date.asc().nullslast(), puis par statut (tri stable).
  domains.sort((a, b) => (a.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY) - (b.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY));
  domains = textSearch(domains, q, ["name", "registrar", "description"]);
  domains.sort((a, b) => statusRank(a.status) - statusRank(b.status));
  const perPage = await resolvePerPage(params, page.user, "domains.list");
  const [rows, p] = paginate(domains, params, perPage);
  const { user, csrf } = page;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Domaines <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">Expiration des noms de domaine, vérifiée auprès du registre (RDAP)</p>
        </div>
        <div className="page-actions">
          <CsvToolbar csvKey="domains" canEdit={user.canEdit("domains")} csrf={csrf} />
          {user.canEdit("domains") ? (
            <a href="/domains/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouveau domaine
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
                <th>Domaine</th>
                <th>Expiration</th>
                <th>Registrar</th>
                <th>Renouvellement</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((d) => (
                  <tr key={d.id} className={`row-${d.status}`}>
                    <td>
                      <a href={`/domains/${d.id}`} className="fw-medium text-decoration-none">
                        {d.name}
                      </a>
                    </td>
                    <td>{d.expiryDate ? <Cellule principal={dateCourte(d.expiryDate)} secondaire={<DelaiBadge days={d.expiryDate} status={d.status} passe="expiré depuis" />} /> : <span className="text-muted">à renseigner</span>}</td>
                    <td>
                      {d.registrarSupplier ? (
                        <a href={`/suppliers/${d.registrarId}`} className="text-decoration-none">
                          {d.registrarSupplier.name}
                        </a>
                      ) : (
                        d.registrar || "—"
                      )}
                    </td>
                    <td>
                      {d.autoRenew ? (
                        <>
                          <Icone bi="bi-arrow-repeat" taille="1em" classes="me-1 text-muted" />
                          Automatique
                        </>
                      ) : (
                        "Manuel"
                      )}
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <Vide colonnes={5} message="Aucun domaine." urlAjout={user.canEdit("domains") ? "/domains/create" : null} />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
