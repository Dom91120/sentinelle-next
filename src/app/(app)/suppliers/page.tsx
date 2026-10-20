import { Icone } from "@/components/icones";
import { Barre, PaginationBar } from "@/components/liste";
import { kindLabel, SEARCH_FIELDS } from "@/modules/suppliers/server";
import { prisma } from "@/server/db";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Fournisseurs - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** suppliers/list.html */
export default async function SuppliersList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("suppliers");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  let suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  suppliers = textSearch(suppliers, q, SEARCH_FIELDS as (keyof (typeof suppliers)[number])[]);
  const perPage = await resolvePerPage(params, page.user, "suppliers.list");
  const [rows, p] = paginate(suppliers, params, perPage);
  const { user } = page;
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Fournisseurs <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            Qui appeler en cas d'incident : hotlines, n° client, portails
          </p>
        </div>
        <div className="page-actions">
          {user.canEdit("suppliers") ? (
            <a href="/suppliers/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouveau fournisseur
            </a>
          ) : null}
        </div>
      </div>

      <Barre q={q} pathname={page.pathname} search={page.search} />

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 tableau-fournisseurs">
            <colgroup>
              <col style={{ width: "26%" }} />
              <col style={{ width: "27%" }} />
              <col style={{ width: "27%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th>Contact commercial</th>
                <th>Support</th>
                <th>Horaires du support</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((s) => {
                  const ccNom = s.commercialContact || s.contactName;
                  const ccMail = s.commercialEmail || s.email;
                  const ccTel = s.commercialPhone || s.phone;
                  return (
                    <tr key={s.id}>
                      <td>
                        <span className="d-flex align-items-center gap-2">
                          <a
                            href={`/suppliers/${s.id}`}
                            className="fw-medium text-decoration-none text-truncate"
                            style={{ minWidth: 0 }}
                            title={s.name}
                          >
                            {s.name}
                          </a>
                          {s.kind !== "editor" ? (
                            <span className="badge-status badge-muted flex-shrink-0">
                              {kindLabel(s)}
                            </span>
                          ) : null}
                        </span>
                        {s.website ? (
                          <a
                            href={s.website}
                            target="_blank"
                            rel="noopener"
                            className="d-block text-truncate pile-site"
                            title={`Ouvrir ${s.website}`}
                          >
                            {s.website}
                          </a>
                        ) : null}
                      </td>
                      <td>
                        <div className="pile">
                          {ccMail ? (
                            <a
                              href={`mailto:${ccMail}`}
                              className="pile-principal"
                              title={`Écrire à ${ccMail}`}
                            >
                              <Icone bi="bi-envelope" taille="1em" />
                              <span className="text-truncate">{ccNom || ccMail}</span>
                            </a>
                          ) : ccNom ? (
                            <span className="pile-principal">
                              <span className="text-truncate">{ccNom}</span>
                            </span>
                          ) : null}
                          {ccTel ? (
                            <a
                              href={`tel:${ccTel.replace(/ /g, "")}`}
                              className="pile-faint text-nowrap"
                            >
                              <Icone bi="bi-telephone" taille="1em" />
                              {ccTel}
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="pile">
                          {s.supportUrl ? (
                            <a
                              href={s.supportUrl}
                              target="_blank"
                              rel="noopener"
                              className="pile-accent casse"
                              title="Ouvrir le portail support"
                            >
                              <Icone bi="bi-globe2" taille="1em" />
                              {s.supportUrl}
                            </a>
                          ) : null}
                          {s.supportEmail ? (
                            <a
                              href={`mailto:${s.supportEmail}`}
                              className="pile-faint casse"
                              title={`Écrire à ${s.supportEmail}`}
                            >
                              <Icone bi="bi-envelope" taille="1em" />
                              {s.supportEmail}
                            </a>
                          ) : null}
                          {s.supportPhone ? (
                            <a
                              href={`tel:${s.supportPhone.replace(/ /g, "")}`}
                              className="pile-faint text-nowrap"
                            >
                              <Icone bi="bi-telephone" taille="1em" />
                              {s.supportPhone}
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="cell-horaires text-muted">
                        {s.hours ? <span className="d-block">{s.hours}</span> : null}
                        {s.hours2 ? <span className="d-block">{s.hours2}</span> : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    <Icone bi="bi-building" taille="1em" style="font-size: 2rem;" />
                    <p className="mt-2 mb-0">
                      Aucun fournisseur.{" "}
                      {user.canEdit("suppliers") ? (
                        <a href="/suppliers/create" className="btn btn-sm btn-primary mt-1">
                          <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Ajouter le premier
                        </a>
                      ) : null}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar p={p} pathname={page.pathname} search={page.search} />
    </>
  );
}
