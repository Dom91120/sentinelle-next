import { Icone } from "@/components/icones";
import { rechercher } from "@/server/recherche";
import { contextePage } from "@/server/page";

export const metadata = { title: "Recherche - Sentinelle" };

/** search.html */
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const page = await contextePage();
  const q = String((await searchParams).q ?? "").trim();
  const results = await rechercher(q, page.user);
  return (
    <>
      <div className="mb-4">
        <h1 className="page-title mb-3">Recherche globale</h1>
        <form method="GET" action="/search">
          <div className="input-group" style={{ maxWidth: 600 }}>
            <input type="text" name="q" className="form-control form-control-lg" defaultValue={q} placeholder="Rechercher un service, compte, domaine, logiciel, pièce jointe..." autoFocus />
            <button type="submit" className="btn btn-primary">
              <Icone bi="bi-search" taille="1em" classes="me-1" /> Rechercher
            </button>
          </div>
        </form>
      </div>

      {q ? (
        <>
          <div className="mb-3">
            <small className="text-muted">
              {results.length} resultat(s) pour "{q}"
            </small>
          </div>
          {results.length ? (
            <div className="data-card">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Nom</th>
                      <th>Detail</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={`${r.url}-${i}`}>
                        <td>
                          <span className={`badge-status badge-${r.badge}`}>
                            <Icone bi={r.icon} taille={12} classes="me-1" />
                            {r.type}
                          </span>
                        </td>
                        <td className="fw-medium">{r.label}</td>
                        <td className="text-muted">{r.detail}</td>
                        <td>
                          <a href={r.url} className="btn btn-sm btn-outline-primary">
                            <Icone bi="bi-eye" taille="1em" classes="me-1" /> Voir
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="data-card p-4 text-center text-muted">
              <Icone bi="bi-search" taille="1em" style="font-size: 2rem;" />
              <p className="mt-2 mb-0">Aucun resultat pour "{q}"</p>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
