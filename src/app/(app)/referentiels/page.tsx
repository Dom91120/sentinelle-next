import { Icone } from "@/components/icones";
import { REFERENTIAL_KINDS, REFERENTIAL_SCOPES } from "@/lib/constantes";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { contextePage } from "@/server/page";

export const metadata = { title: "Référentiels - Sentinelle" };

/** referentials/index.html : listes de valeurs administrables et services utilisateurs. */
export default async function Referentiels() {
  const page = await contextePage();
  await requireAdmin();
  const { csrf } = page;
  const [valeurs, services] = await Promise.all([
    prisma.referential.findMany({ orderBy: [{ position: "asc" }, { label: "asc" }] }),
    prisma.userService.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        software: { where: { software: { isActive: true } }, select: { softwareId: true } },
      },
    }),
  ]);
  const listes = Object.fromEntries(
    Object.keys(REFERENTIAL_KINDS).map((kind) => [kind, valeurs.filter((v) => v.kind === kind)]),
  );
  const actifs = services.filter((s) => s.isActive).length;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">Référentiels</h1>
          <p className="page-subtitle">Les listes de valeurs proposées dans les formulaires</p>
        </div>
        <a href="/preferences" className="btn btn-outline-secondary">
          <Icone bi="bi-arrow-left" taille="1em" classes="me-1" /> Préférences
        </a>
      </div>

      <div className="alert alert-info py-2 px-3 small">
        <Icone bi="bi-info-circle" taille="1em" classes="me-1" />
        Seuls les libellés <strong>descriptifs</strong> se règlent ici. Le cycle de vie d'un
        logiciel, l'hébergement, la criticité ou le statut d'un certificat pilotent des filtres, des
        compteurs et des couleurs : ils restent fixes, parce qu'en ajouter ou en retirer laisserait
        des fiches orphelines et des filtres qui ne filtrent plus.
      </div>

      <div className="row g-3">
        {Object.entries(REFERENTIAL_KINDS).map(([kind, label]) => {
          const portees = REFERENTIAL_SCOPES[kind];
          return (
            <div key={kind} className="col-lg-4">
              <div className="data-card h-100">
                <div className="card-header-custom">
                  <h6 className="fw-bold mb-0">
                    {label} <span className="badge bg-secondary ms-1">{listes[kind].length}</span>
                  </h6>
                </div>
                <ul className="list-group list-group-flush">
                  {listes[kind].length ? (
                    listes[kind].map((item) => (
                      <li
                        key={item.id}
                        className="list-group-item d-flex justify-content-between align-items-center py-2"
                      >
                        <span>{item.label}</span>
                        {portees ? (
                          <form
                            method="POST"
                            action={`/referentiels/${item.id}/scope`}
                            className="ms-auto me-2"
                          >
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <select
                              name="scope"
                              className="form-select form-select-sm"
                              style={{ width: "auto" }}
                              aria-label={`Type de fiche pour ${item.label}`}
                              defaultValue={item.scope || "tous"}
                              data-soumettre-au-changement=""
                            >
                              {Object.entries(portees).map(([valeur, libelle]) => (
                                <option key={valeur} value={valeur}>
                                  {libelle}
                                </option>
                              ))}
                            </select>
                          </form>
                        ) : null}
                        <form method="POST" action={`/referentiels/${item.id}/delete`}>
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <button
                            type="submit"
                            className="btn btn-sm btn-outline-danger"
                            title="Retirer de la liste"
                            aria-label="Retirer de la liste"
                            data-confirm={`Retirer « ${item.label} » ? Les fiches qui la portent la gardent.`}
                          >
                            <Icone bi="bi-x-lg" taille="1em" />
                          </button>
                        </form>
                      </li>
                    ))
                  ) : (
                    <li className="list-group-item text-muted py-3 text-center">Liste vide</li>
                  )}
                </ul>
                <form method="POST" action="/referentiels/add" className="p-2 border-top">
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <input type="hidden" name="kind" value={kind} />
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      name="label"
                      className="form-control"
                      placeholder="Nouvelle valeur"
                      aria-label={`Nouvelle valeur pour ${label}`}
                      required
                    />
                    {portees ? (
                      <select
                        name="scope"
                        className="form-select"
                        style={{ maxWidth: "9rem" }}
                        aria-label="Type de fiche de la nouvelle valeur"
                      >
                        {Object.entries(portees).map(([valeur, libelle]) => (
                          <option key={valeur} value={valeur}>
                            {libelle}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      type="submit"
                      className="btn btn-outline-primary"
                      title="Ajouter"
                      aria-label="Ajouter"
                    >
                      <Icone bi="bi-plus-lg" taille="1em" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <div className="data-card mt-3">
        <div className="card-header-custom">
          <h6 className="fw-bold mb-0">
            <Icone bi="bi-people" taille="1em" classes="me-2 text-primary" />
            Services utilisateurs <span className="badge bg-secondary ms-1">{actifs}</span>
          </h6>
        </div>
        <form
          method="POST"
          action="/referentiels/services/add"
          className="p-3 border-bottom bg-body-tertiary"
        >
          <input type="hidden" name="csrf_token" value={csrf} />
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1" htmlFor="svcName">
                Service *
              </label>
              <input
                type="text"
                name="name"
                id="svcName"
                className="form-control form-control-sm"
                required
                placeholder="État civil, Urbanisme, Finances..."
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1" htmlFor="svcContact">
                Référent
              </label>
              <input
                type="text"
                name="contact_name"
                id="svcContact"
                className="form-control form-control-sm"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1" htmlFor="svcEmail">
                Email
              </label>
              <input
                type="email"
                name="contact_email"
                id="svcEmail"
                className="form-control form-control-sm"
              />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1" htmlFor="svcPhone">
                Téléphone
              </label>
              <input
                type="text"
                name="contact_phone"
                id="svcPhone"
                className="form-control form-control-sm"
              />
            </div>
            <div className="col-md-1">
              <button
                type="submit"
                className="btn btn-sm btn-primary w-100"
                title="Ajouter le service"
                aria-label="Ajouter le service"
              >
                <Icone bi="bi-plus-lg" taille="1em" />
              </button>
            </div>
          </div>
        </form>
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Service</th>
                <th>Référent</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Logiciels</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {services.length ? (
                services.map((sv) => (
                  <tr key={sv.id} className={sv.isActive ? "" : "opacity-50"}>
                    <td>
                      <form
                        method="POST"
                        action={`/referentiels/services/${sv.id}/edit`}
                        id={`svc${sv.id}`}
                      >
                        <input type="hidden" name="csrf_token" value={csrf} />
                      </form>
                      <input
                        type="text"
                        name="name"
                        form={`svc${sv.id}`}
                        defaultValue={sv.name}
                        className="form-control form-control-sm border-0"
                        aria-label="Nom du service"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="contact_name"
                        form={`svc${sv.id}`}
                        defaultValue={sv.contactName || ""}
                        className="form-control form-control-sm border-0"
                        aria-label="Référent"
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        name="contact_email"
                        form={`svc${sv.id}`}
                        defaultValue={sv.contactEmail || ""}
                        className="form-control form-control-sm border-0"
                        aria-label="Email du référent"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="contact_phone"
                        form={`svc${sv.id}`}
                        defaultValue={sv.contactPhone || ""}
                        className="form-control form-control-sm border-0"
                        aria-label="Téléphone du référent"
                      />
                    </td>
                    <td className="small text-nowrap">{sv.software.length}</td>
                    <td className="text-end text-nowrap">
                      <div className="d-flex gap-1 justify-content-end">
                        <button
                          type="submit"
                          form={`svc${sv.id}`}
                          className="btn btn-sm btn-outline-primary"
                          title="Enregistrer"
                          aria-label="Enregistrer"
                        >
                          <Icone bi="bi-check-lg" taille="1em" />
                        </button>
                        {sv.isActive ? (
                          <form method="POST" action={`/referentiels/services/${sv.id}/delete`}>
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <button
                              type="submit"
                              className="btn btn-sm btn-outline-danger"
                              title="Retirer des listes"
                              aria-label="Retirer des listes"
                              data-confirm={`Retirer « ${sv.name} » des listes ? Les fiches qui le nomment continuent de l'afficher.`}
                            >
                              <Icone bi="bi-x-lg" taille="1em" />
                            </button>
                          </form>
                        ) : (
                          <span className="badge bg-secondary align-self-center">Retiré</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-3 text-muted">
                    Aucun service enregistré
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
