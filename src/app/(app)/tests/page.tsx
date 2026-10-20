import { Icone } from "@/components/icones";
import { Barre, Cellule, CsvToolbar, PaginationBar, Vide } from "@/components/liste";
import { DelaiBadge, StatusBadge } from "@/components/macros";
import { TEST_TYPE_LABELS, statusRank } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { chargerTests } from "@/server/donnees";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Tests - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** tests/list.html */
export default async function TestsList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("tests");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  let tests = await chargerTests();
  // TestTask.next_due.asc().nullsfirst(), puis par statut (tri stable).
  tests.sort((a, b) => (a.nextDue?.getTime() ?? Number.NEGATIVE_INFINITY) - (b.nextDue?.getTime() ?? Number.NEGATIVE_INFINITY));
  tests = textSearch(tests, q, ["name", "testType", "description"]);
  tests.sort((a, b) => statusRank(a.status) - statusRank(b.status));
  const perPage = await resolvePerPage(params, page.user, "tests.list");
  const [rows, p] = paginate(tests, params, perPage);
  const { user, csrf } = page;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Tests <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">Restaurations, sauvegardes sur clé, vérifications d'intégrité : les tests à refaire régulièrement</p>
        </div>
        <div className="page-actions">
          <a href="/tests/kanban" className="btn btn-outline-secondary">
            <Icone bi="bi-kanban" taille="1em" classes="me-1" /> Kanban
          </a>
          <CsvToolbar csvKey="tests" canEdit={user.canEdit("tests")} csrf={csrf} />
          {user.canEdit("tests") ? (
            <a href="/tests/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouveau test
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
                <th>Test</th>
                <th>Prochaine échéance</th>
                <th>Dernière exécution</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((test) => (
                  <tr key={test.id} className={`row-${test.status}`}>
                    <td>
                      <a href={`/tests/${test.id}`} className="fw-medium text-decoration-none">
                        {test.name}
                      </a>
                      {TEST_TYPE_LABELS[test.testType] ? <small className="d-block text-muted">{TEST_TYPE_LABELS[test.testType]}</small> : null}
                    </td>
                    <td>{test.nextDue ? <Cellule principal={dateCourte(test.nextDue)} secondaire={<DelaiBadge days={test.nextDue} status={test.status} />} /> : <span className="text-muted">à planifier</span>}</td>
                    <td>{test.lastPerformed ? dateCourte(test.lastPerformed) : "—"}</td>
                    <td>
                      <StatusBadge status={test.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <Vide colonnes={5} message="Aucun test." urlAjout={user.canEdit("tests") ? "/tests/create" : null} />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
