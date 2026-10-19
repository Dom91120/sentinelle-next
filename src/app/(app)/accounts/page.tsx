import { Icone } from "@/components/icones";
import { Barre, Cellule, CsvToolbar, PaginationBar, Vide } from "@/components/liste";
import { DelaiBadge, StatusBadge } from "@/components/macros";
import { statusRank } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { chargerComptes } from "@/server/donnees";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Comptes - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** accounts/list.html */
export default async function AccountsList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("accounts");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  let accounts = await chargerComptes();
  accounts = textSearch(accounts, q, ["serviceName", "username", "url", "description"]);
  accounts.sort((a, b) => statusRank(a.status) - statusRank(b.status));
  const perPage = await resolvePerPage(params, page.user, "accounts.list");
  const [rows, p] = paginate(accounts, params, perPage);
  const { user, csrf } = page;
  const cfg = user.settings;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Comptes <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">Rotation des mots de passe des comptes techniques et d'administration</p>
        </div>
        <div className="page-actions">
          {cfg.LDAP_ENABLED && cfg.LDAP_BIND_USER && user.canEdit("accounts") ? (
            <form method="POST" action="/accounts/sync-ad" className="d-inline">
              <input type="hidden" name="csrf_token" value={csrf} />
              <button type="submit" className="btn btn-outline-secondary" title="Synchroniser depuis Active Directory" data-confirm="Synchroniser les expirations de mots de passe depuis l'AD ?">
                <Icone bi="bi-arrow-repeat" taille="1em" classes="me-1" /> Synchroniser AD
              </button>
            </form>
          ) : null}
          <CsvToolbar csvKey="accounts" canEdit={user.canEdit("accounts")} csrf={csrf} />
          {user.canEdit("accounts") ? (
            <a href="/accounts/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouveau compte
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
                <th>Utilisateur</th>
                <th className="th-2l">
                  Prochain
                  <br />
                  changement
                </th>
                <th className="th-2l">
                  Dernier
                  <br />
                  changement
                </th>
                <th>Rotation</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((account) => (
                  <tr key={account.id} className={`row-${account.status}`}>
                    <td>
                      <a href={`/accounts/${account.id}`} className="fw-medium text-decoration-none">
                        {account.serviceName}
                      </a>
                      {account.url ? <small className="d-block text-muted">{account.url}</small> : null}
                    </td>
                    <td>{account.username}</td>
                    <td>
                      {account.nextPasswordChange ? (
                        <Cellule principal={dateCourte(account.nextPasswordChange)} secondaire={<DelaiBadge days={account.nextPasswordChange} status={account.status} />} />
                      ) : (
                        <span className="text-muted">à renseigner</span>
                      )}
                    </td>
                    <td>{account.lastPasswordChange ? dateCourte(account.lastPasswordChange) : "—"}</td>
                    <td>{account.rotationDays ? `tous les ${account.rotationDays} j` : "—"}</td>
                    <td>
                      <StatusBadge status={account.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <Vide colonnes={7} message="Aucun compte enregistré." urlAjout={user.canEdit("accounts") ? "/accounts/create" : null} />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
