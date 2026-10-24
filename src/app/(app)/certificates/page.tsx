import { Icone, Lucide } from "@/components/icones";
import { Barre, CsvToolbar, PaginationBar, SegTabs, Vide } from "@/components/liste";
import { CERT_KIND_LABELS, statusRank } from "@/lib/constantes";
import { dateCourte, delai, jours } from "@/lib/libelles";
import {
  certificateHolderLabel,
  certificateLabel,
  certificateSupportLabel,
  certificateUsageLabel,
} from "@/lib/statuts";
import { prisma } from "@/server/db";
import { chargerCertificats } from "@/server/donnees";
import { contexteModule } from "@/server/module";
import { paginate, resolvePerPage, textSearch } from "@/server/paging";

export const metadata = { title: "Certificats - Sentinelle" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/** certificates/list.html */
export default async function CertificatesList({ searchParams }: { searchParams: Params }) {
  const page = await contexteModule("certificates");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const kindParam = String(params.kind ?? "").trim();
  const kind = kindParam in CERT_KIND_LABELS ? kindParam : "";
  const tous = await chargerCertificats();
  // Certificate.expiry_date.asc() (NULL en tête, comme SQLite), puis par statut (tri stable).
  tous.sort(
    (a, b) =>
      (a.expiryDate?.getTime() ?? Number.NEGATIVE_INFINITY) -
      (b.expiryDate?.getTime() ?? Number.NEGATIVE_INFINITY),
  );
  const services = new Map(
    (await prisma.userService.findMany({ select: { id: true, name: true } })).map((s) => [
      s.id,
      s.name,
    ]),
  );
  const totalAll = tous.length;
  const counts = Object.fromEntries(
    Object.keys(CERT_KIND_LABELS).map((k) => [
      k,
      tous.filter((c) => (c.kind || "tls") === k).length,
    ]),
  );
  let certificates = kind ? tous.filter((c) => (c.kind || "tls") === kind) : tous;
  certificates = textSearch(certificates, q, [
    "serviceName",
    "domain",
    "issuer",
    "holder",
    "firstName",
    "holderRole",
    "serialNumber",
    "description",
  ]);
  certificates.sort((a, b) => statusRank(a.status) - statusRank(b.status));
  const perPage = await resolvePerPage(params, page.user, "certificates.list");
  const [rows, p] = paginate(certificates, params, perPage);
  const { user, csrf } = page;
  const qs = q ? `&q=${encodeURIComponent(q)}` : "";
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Certificats <span className="page-count">{p.total}</span>
            <button
              type="button"
              className="help-toggle"
              data-bs-toggle="collapse"
              data-bs-target="#aideCertificats"
              aria-expanded="false"
              aria-controls="aideCertificats"
              title="Procédure de renouvellement du wildcard"
            >
              ?
            </button>
          </h1>
          <p className="page-subtitle">
            Expirations TLS et certificats électroniques (RGS / eIDAS)
          </p>
        </div>
        <div className="page-actions">
          <CsvToolbar csvKey="certificates" canEdit={user.canEdit("certificates")} csrf={csrf} />
          {user.canEdit("certificates") ? (
            <div className="dropdown">
              <button
                className="btn btn-primary dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouveau certificat
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li>
                  <a className="dropdown-item" href="/certificates/create?kind=tls">
                    <Icone bi="bi-award" taille="1em" classes="me-2" />
                    Certificat TLS
                  </a>
                </li>
                <li>
                  <a className="dropdown-item" href="/certificates/create?kind=signature">
                    <Icone bi="bi-person-badge" taille="1em" classes="me-2" />
                    Certificat électronique
                  </a>
                </li>
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="collapse" id="aideCertificats">
        <div className="alert alert-info d-flex align-items-start mb-3">
          <Icone bi="bi-tools" taille="1em" classes="me-2 mt-1" />
          <div>
            <strong>Renouvellement du wildcard *.collectivite.fr :</strong> l'outil{" "}
            <strong>cert-deploy</strong> automatise toute la campagne (CSR, déploiement
            Linux/Windows/NPM/NAS, vérification, suivi). Sur le poste d'admin&nbsp;:{" "}
            <code>C:\tmp\CERTIFICATS 2026-2027\cert-deploy\start.bat</code> →{" "}
            <code>http://127.0.0.1:8443</code> (bouton « Manuel » intégré). Il est volontairement
            séparé de Sentinelle&nbsp;: il manipule la clé privée et des comptes administrateurs, et
            ne tourne qu'à la demande, en local sur le poste.
          </div>
        </div>
      </div>

      <Barre
        q={q}
        hidden={{ kind }}
        pathname={page.pathname}
        search={page.search}
        segments={
          <SegTabs
            tabs={[
              {
                href: `/certificates?${qs.slice(1)}`,
                label: "Tous ",
                count: totalAll,
                active: !kind,
              },
              ...Object.entries(CERT_KIND_LABELS).map(([value, label]) => ({
                href: `/certificates?kind=${value}${qs}`,
                label: `${label} `,
                count: counts[value],
                active: kind === value,
              })),
            ]}
          />
        }
      />

      <div className="data-card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 js-filterable tableau-certificats">
            <colgroup>
              <col style={{ width: "26%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "14%" }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Service</th>
                <th>Autorité</th>
                <th>Validité</th>
                <th>Type / Modèle</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((cert) => {
                  const electronique = cert.kind === "signature";
                  const qualite = [cert.holderRole, certificateUsageLabel(cert)]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={cert.id} className={`row-${cert.status}`}>
                      <td>
                        <a
                          href={`/certificates/${cert.id}`}
                          className="fw-medium text-decoration-none d-block text-truncate"
                          title={certificateLabel(cert)}
                        >
                          {electronique
                            ? certificateHolderLabel(cert) || cert.serviceName
                            : cert.serviceName}
                        </a>
                        {electronique ? (
                          qualite ? (
                            <small className="d-block text-truncate text-faint">{qualite}</small>
                          ) : null
                        ) : cert.domain ? (
                          <small className="d-block text-truncate text-faint">{cert.domain}</small>
                        ) : null}
                      </td>
                      <td className="text-muted text-truncate">
                        {cert.serviceId ? (services.get(cert.serviceId) ?? "—") : "—"}
                      </td>
                      <td className="text-muted text-truncate">
                        {electronique
                          ? (cert.supplier?.name ?? "—")
                          : (cert.supplier?.name ?? cert.issuer ?? "—")}
                      </td>
                      <td>
                        <small className="d-block text-muted text-nowrap tabular">
                          {cert.issuedAt ? dateCourte(cert.issuedAt) : "…"} →{" "}
                          {cert.expiryDate ? dateCourte(cert.expiryDate) : "…"}
                        </small>
                        {cert.validity === "revoque" ? (
                          <span className="badge-status badge-danger mt-1">
                            <Lucide nom="calendar-clock" taille={12} />
                            Révoqué
                          </span>
                        ) : !cert.expiryDate ? (
                          <span className="badge-status badge-warning mt-1">
                            <Lucide nom="calendar-clock" taille={12} />
                            Date à renseigner
                          </span>
                        ) : (
                          <span className={`badge-status badge-${cert.status} mt-1`}>
                            <Lucide nom="calendar-clock" taille={12} />
                            {delai(jours(cert.expiryDate), "expiré depuis")}
                          </span>
                        )}
                      </td>
                      <td className="text-muted">
                        {electronique ? (
                          <>
                            <span className="d-block text-truncate">
                              {cert.level || certificateSupportLabel(cert) || "Électronique"}
                            </span>
                            {cert.level && cert.support ? (
                              <small className="d-block text-truncate text-faint">
                                {certificateSupportLabel(cert)}
                              </small>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <span className="d-block">
                              {cert.domain?.startsWith("*.") ? "Wildcard" : "TLS"}
                            </span>
                            <small className="d-block text-faint">
                              {cert.autoRenew ? (
                                <>
                                  <Icone bi="bi-arrow-repeat" taille={12} classes="me-1" />
                                  Automatique
                                </>
                              ) : (
                                "Manuel"
                              )}
                            </small>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <Vide
                  colonnes={5}
                  message="Aucun certificat."
                  urlAjout={
                    user.canEdit("certificates")
                      ? `/certificates/create?kind=${kind || "tls"}`
                      : null
                  }
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
