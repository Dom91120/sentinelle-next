import { Icone } from "@/components/icones";
import { Barre, Cellule, CsvToolbar, PaginationBar, Vide } from "@/components/liste";
import { DelaiBadge, StatusBadge } from "@/components/macros";
import { dateCourte } from "@/lib/libelles";
import { chargerRevues } from "@/server/donnees";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";
import { triRevues } from "@/server/tri-fiches";

export const metadata = { title: "Revues de droits - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** reviews/list.html */
export default async function ReviewsList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("reviews");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  let reviews = await chargerRevues();
  // Par statut puis prochaine revue, le plus urgent en tête (le même ordre que les chevrons).
  reviews.sort(triRevues);
  reviews = textSearch(reviews, q, ["application", "responsible", "scope"]);
  const perPage = await resolvePerPage(params, page.user, "reviews.list");
  const [rows, p] = paginate(reviews, params, perPage);
  const { user, csrf } = page;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Revues de droits <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">Revue périodique des accès aux applications métiers</p>
        </div>
        <div className="page-actions">
          <CsvToolbar csvKey="reviews" canEdit={user.canEdit("reviews")} csrf={csrf} />
          {user.canEdit("reviews") ? (
            <a href="/reviews/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouvelle revue
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
                <th>Prochaine revue</th>
                <th>Responsable</th>
                <th>Fréquence</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => (
                  <tr key={r.id} className={`row-${r.status}`}>
                    <td>
                      <a href={`/reviews/${r.id}`} className="fw-medium text-decoration-none">
                        {r.application}
                      </a>
                    </td>
                    <td>
                      {r.nextReview ? (
                        <Cellule
                          principal={dateCourte(r.nextReview)}
                          secondaire={<DelaiBadge days={r.nextReview} status={r.status} />}
                        />
                      ) : (
                        <span className="text-muted">à planifier</span>
                      )}
                    </td>
                    <td>{r.responsible || "—"}</td>
                    <td>tous les {r.frequencyDays} j</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <Vide
                  colonnes={6}
                  message="Aucune revue de droits enregistrée."
                  urlAjout={user.canEdit("reviews") ? "/reviews/create" : null}
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
