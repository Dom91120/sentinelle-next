import { Icone } from "@/components/icones";
import { Barre, PaginationBar } from "@/components/liste";
import { statusRank } from "@/lib/constantes";
import {
  criticalityColor,
  criticalityLabel,
  lifecycleColor,
  lifecycleLabel,
  SEARCH_FIELDS,
} from "@/modules/software/server";
import { prisma } from "@/server/db";
import { chargerLogiciels } from "@/server/donnees";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Logiciels métiers - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** software/list.html */
export default async function SoftwareList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("software");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const host = String(params.host ?? "").trim();
  const tous = await chargerLogiciels();
  // Software.query.filter_by(is_active=True).order_by(Software.name) : ordre binaire de SQLite.
  tous.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const totalAll = tous.length;
  const match: Record<string, (s: (typeof tous)[number]) => boolean> = {
    docker: (s) => s.isDocker,
    saas: (s) => s.hosting === "saas" || s.hosting === "hybride",
    onprem: (s) => s.hosting === "on_premise" || s.hosting === "hybride",
  };
  const counts = Object.fromEntries(
    Object.entries(match).map(([k, fn]) => [k, tous.filter(fn).length]),
  );
  let items = host in match ? tous.filter(match[host]) : tous;
  items = textSearch(items, q, SEARCH_FIELDS as (keyof (typeof items)[number])[]);
  items.sort((a, b) => statusRank(a.status) - statusRank(b.status));
  const perPage = await resolvePerPage(params, page.user, "software.list");
  const [rows, p] = paginate(items, params, perPage);
  const ids = rows.map((s) => s.id);
  const [technos, services] = await Promise.all([
    prisma.referential.findMany({
      where: { id: { in: rows.map((s) => s.technologyId).filter((x): x is number => x !== null) } },
    }),
    prisma.softwareService.findMany({
      where: { softwareId: { in: ids } },
      orderBy: { userServiceId: "asc" },
      include: { userService: { select: { name: true } } },
    }),
  ]);
  const technoPar = new Map(technos.map((t) => [t.id, t.label]));
  const servicesPar = new Map<number, string[]>();
  for (const l of services)
    servicesPar.set(l.softwareId, [...(servicesPar.get(l.softwareId) ?? []), l.userService.name]);
  const { user } = page;
  const qs = q ? `&q=${encodeURIComponent(q)}` : "";
  const tabs: [string, string, number][] = [
    ["", "Tous", totalAll],
    ["docker", "Docker", counts.docker],
    ["saas", "SaaS", counts.saas],
    ["onprem", "On premise", counts.onprem],
  ];
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Logiciels <span className="page-count">{p.total}</span>
          </h1>
          <p className="page-subtitle">
            Applications métiers, hébergement, éditeur et mises à jour
          </p>
        </div>
        <div className="page-actions">
          {user.canEdit("software") ? (
            <a href="/inventory/logiciels/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouveau logiciel
            </a>
          ) : null}
        </div>
      </div>

      <Barre
        q={q}
        hidden={{ host }}
        pathname={page.pathname}
        search={page.search}
        segments={
          <div className="seg-tabs">
            {tabs.map(([val, lbl, cnt]) => (
              <a
                key={val}
                className={`seg-tab${host === val ? " active" : ""}`}
                href={`/inventory/logiciels?host=${val}${qs}`}
              >
                {val === "docker" ? <i className="icon-docker me-1" /> : null}
                {lbl} <span className="seg-tab-count">{cnt}</span>
              </a>
            ))}
          </div>
        }
      />

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle tableau-logiciels">
            <colgroup>
              <col style={{ width: "35%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "35%" }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 124 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Logiciel</th>
                <th>Éditeur</th>
                <th>Services</th>
                <th className="text-center pe-0">Criticité</th>
                <th className="text-center pe-0">Cycle de vie</th>
                <th className="text-center pe-0">Hébergement</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((s) => {
                  const cc = criticalityColor(s);
                  const lc = lifecycleColor(s);
                  const techno = s.technologyId ? technoPar.get(s.technologyId) : null;
                  return (
                    <tr key={s.id}>
                      <td>
                        <span className="d-flex align-items-center gap-1">
                          <a
                            href={`/inventory/logiciels/${s.id}`}
                            className="fw-medium text-decoration-none text-truncate"
                            style={{ minWidth: 0 }}
                            title={s.name}
                          >
                            {s.name}
                          </a>
                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-faint flex-shrink-0"
                              title={`Ouvrir ${s.url}`}
                              aria-label="Ouvrir le site du logiciel"
                            >
                              <Icone bi="bi-box-arrow-up-right" taille="1em" />
                            </a>
                          ) : null}
                          {s.isDocker ? (
                            <i
                              className="icon-docker flex-shrink-0"
                              title="Conteneurisé (Docker)"
                              aria-label="Conteneurisé (Docker)"
                            />
                          ) : null}
                        </span>
                        {techno ? (
                          <small className="d-block text-truncate text-faint">{techno}</small>
                        ) : null}
                      </td>
                      <td className="text-truncate">
                        {s.internalDev ? (
                          <span className="text-muted" title="Développement interne">
                            Développement interne
                          </span>
                        ) : s.supplier ? (
                          <a
                            href={`/suppliers/${s.supplierId}`}
                            className="text-decoration-none"
                            title={s.supplier.name}
                          >
                            {s.supplier.name}
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="cell-services text-muted">
                        {(servicesPar.get(s.id) ?? []).join(" · ") || "—"}
                      </td>
                      <td className="text-center pe-0">
                        {s.criticality ? (
                          <span
                            className={`badge-status ${cc === "secondary" ? "badge-muted" : `badge-${cc}`}`}
                          >
                            {criticalityLabel(s).split(" - ").pop()}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="text-center pe-0">
                        <span
                          className={`badge-status ${lc === "secondary" ? "badge-muted" : `badge-${lc}`}`}
                        >
                          {lifecycleLabel(s)}
                        </span>
                      </td>
                      <td className="text-center pe-0">
                        {s.hosting === "saas" ? (
                          <span className="badge-status badge-info">SaaS</span>
                        ) : s.hosting === "hybride" ? (
                          <span className="badge-status badge-warning">Hybride</span>
                        ) : (
                          <span className="badge-status badge-accent">On premise</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    <Icone bi="bi-window-stack" taille="1em" style="font-size: 2rem;" />
                    <p className="mt-2 mb-0">
                      Aucun logiciel.{" "}
                      {user.canEdit("software") ? (
                        <a
                          href="/inventory/logiciels/create"
                          className="btn btn-sm btn-primary mt-1"
                        >
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
