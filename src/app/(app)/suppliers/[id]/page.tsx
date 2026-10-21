import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Documents } from "@/components/documents";
import { Champ, Entete, Fait, FaitBloc, Faits, Lien, TitreSection } from "@/components/fiche";
import { Icone, Lucide } from "@/components/icones";
import { StatusBadge } from "@/components/macros";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import {
  CERT_KIND_LABELS,
  ENVIRONMENT_LABELS,
  EQUIPMENT_KIND_ICONS,
  EQUIPMENT_KIND_LABELS,
} from "@/lib/constantes";
import { aujourdhui, dateCourte } from "@/lib/libelles";
import { couleurIcone } from "@/lib/navigation";
import {
  accountStatus,
  certificateLabel,
  certificateStatus,
  contractEnCours,
  contractStatus,
  domainStatus,
} from "@/lib/statuts";
import { TableauContrats } from "@/modules/contracts/vues";
import { Contacts } from "@/modules/software/vues";
import { kindLabel } from "@/modules/suppliers/server";
import { FormulaireFournisseur, Synthese } from "@/modules/suppliers/vues";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { documentsEnabled, forParent, hasFile } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";

function milliers(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** suppliers/detail.html */
/** Le titre de l'onglet, comme le `{% block title %}` du gabarit Jinja. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idDeRoute((await params).id);
  const fiche = await prisma.supplier.findUnique({ where: { id }, select: { name: true } });
  return { title: fiche ? `${fiche.name} - Sentinelle` : "Sentinelle" };
}

export default async function SupplierDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("suppliers");
  const id = idDeRoute((await params).id);
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      equipments: { where: { isActive: true }, orderBy: { name: "asc" } },
      contracts: {
        where: { isActive: true },
        orderBy: [{ endDate: { sort: "asc", nulls: "last" } }],
        include: {
          kindRef: true,
          supplier: true,
          software: { include: { software: true } },
          equipments: { include: { equipment: true } },
        },
      },
      software: { where: { isActive: true } },
      domains: { where: { isActive: true }, orderBy: { name: "asc" } },
      accounts: { where: { isActive: true }, orderBy: { serviceName: "asc" } },
      certificates: {
        where: { isActive: true },
        orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }],
      },
    },
  });
  if (!supplier) notFound();
  const { user, csrf } = page;
  const peutEditer = user.canEdit("suppliers");
  const seuils = seuilsDe(user.settings);
  const today = aujourdhui();
  const docsOn = documentsEnabled(user.settings);
  const legacy = user.settings.SUPPLIER_FORM_LEGACY;
  const [voisins, pieces] = await Promise.all([
    voisinsDe("supplier", id, "name", page),
    docsOn ? forParent("supplier", id) : Promise.resolve([]),
  ]);
  const equipments = supplier.equipments;
  const contracts = supplier.contracts;
  const software = [...supplier.software].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  );
  const domains = supplier.domains;
  const accounts = supplier.accounts;
  const certificats = user.canView("certificates") ? supplier.certificates : [];
  const contratsEnCours = contracts.filter((c) => contractEnCours(c, today));
  const rail = contratsEnCours.length || software.length || equipments.length || certificats.length;
  const sousTitre = (
    <>
      {kindLabel(supplier)}
      {supplier.contactName ? ` · ${supplier.contactName}` : ""}
      {supplier.website ? (
        <>
          {" · "}
          <a href={supplier.website} target="_blank" rel="noopener">
            {supplier.website.replace("https://", "").replace("http://", "")}
          </a>
        </>
      ) : null}
    </>
  );
  const telSupport = supplier.supportPhone || supplier.phone;
  const mailSupport = supplier.supportEmail || supplier.email;
  return (
    <>
      <Entete
        titre={supplier.name}
        sousTitre={sousTitre}
        primaire={
          user.canEdit("contracts") ? (
            <a href="/contracts/create" className="btn btn-primary">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Nouveau contrat
            </a>
          ) : null
        }
        voisins={voisins}
        base="/suppliers"
      />

      <BarreOnglets
        id="ficheSupplier"
        modifier={peutEditer ? `/suppliers/${id}/edit` : null}
        surPlace
      >
        <Onglet cible="detail" libelle="Synthèse" icone="bi-card-text" actif />
        {peutEditer ? <Onglet cible="details" libelle="Détails" icone="bi-pencil-square" /> : null}
        <Onglet
          cible="contrats"
          libelle="Contrats"
          icone="bi-file-earmark-text"
          compteur={contracts.length}
        />
        {docsOn ? (
          <Onglet
            cible="documents"
            libelle="Documents"
            icone="bi-paperclip"
            compteur={pieces.length}
          />
        ) : null}
        {equipments.length ? (
          <Onglet
            cible="materiel-couvert"
            libelle="Matériels fournis"
            icone="bi-hdd-stack"
            compteur={equipments.length}
          />
        ) : null}
        {user.canView("domains") && domains.length ? (
          <Onglet cible="domaines" libelle="Domaines" icone="bi-globe" compteur={domains.length} />
        ) : null}
        {user.canView("accounts") && accounts.length ? (
          <Onglet cible="comptes" libelle="Comptes" icone="bi-key" compteur={accounts.length} />
        ) : null}
      </BarreOnglets>

      <Volets>
        <Volet cible="detail" actif>
          <div className="row g-3">
            <div className={rail ? "col-lg-9" : "col-12"}>
              {!legacy ? (
                <Synthese supplier={supplier} />
              ) : (
                <div className="data-card p-3 mb-3">
                  <Faits>
                    <FaitBloc label="Hotline">
                      {telSupport ? (
                        <a href={`tel:${telSupport.replace(/ /g, "")}`}>{telSupport}</a>
                      ) : (
                        "-"
                      )}
                    </FaitBloc>
                    <FaitBloc label="N° client">
                      {supplier.customerRef ? <code>{supplier.customerRef}</code> : "-"}
                    </FaitBloc>
                    <Fait label="Horaires" value={supplier.hours} />
                    <FaitBloc label="E-mail de l'assistance">
                      {mailSupport ? (
                        <a href={`mailto:${mailSupport}`}>{mailSupport}</a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </FaitBloc>
                  </Faits>
                  <div className="fiche-sections">
                    <div className="fiche-bloc fiche-bloc--sky">
                      <TitreSection
                        titre="Assistance"
                        icone="bi-life-preserver"
                        couleur="sky"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ
                          label="Hotline support"
                          value={
                            telSupport ? (
                              <>
                                <Icone bi="bi-telephone" taille="1em" classes="me-1" />
                                <a href={`tel:${telSupport.replace(/ /g, "")}`}>{telSupport}</a>
                                {supplier.hours ? (
                                  <small className="text-muted d-block">{supplier.hours}</small>
                                ) : null}
                                {supplier.hours2 ? (
                                  <small className="text-muted d-block">{supplier.hours2}</small>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-muted">-</span>
                            )
                          }
                        />
                        <Champ
                          label="E-mail de l'assistance"
                          value={
                            mailSupport ? (
                              <a href={`mailto:${mailSupport}`}>{mailSupport}</a>
                            ) : (
                              <span className="text-muted">-</span>
                            )
                          }
                        />
                        <Champ
                          label="N° client / support"
                          value={
                            supplier.customerRef ? (
                              <code>{supplier.customerRef}</code>
                            ) : (
                              <span className="text-muted">-</span>
                            )
                          }
                        />
                        {supplier.supportUrl ? (
                          <Champ
                            label="Portail de tickets"
                            value={
                              <a href={supplier.supportUrl} target="_blank" rel="noopener">
                                <Icone bi="bi-box-arrow-up-right" taille="1em" classes="me-1" />
                                Ouvrir le portail
                              </a>
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="fiche-bloc fiche-bloc--indigo">
                      <TitreSection
                        titre="Coordonnées"
                        icone="bi-building"
                        couleur="slate"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ
                          label="Téléphone standard"
                          value={
                            <>
                              {supplier.phone || "-"}
                              {supplier.email ? (
                                <a
                                  href={`mailto:${supplier.email}`}
                                  className="d-block small text-truncate"
                                >
                                  <Icone bi="bi-envelope" taille="1em" classes="me-1" />
                                  {supplier.email}
                                </a>
                              ) : null}
                            </>
                          }
                        />
                        {supplier.address || supplier.city ? (
                          <Champ
                            label="Adresse"
                            value={
                              <>
                                {supplier.address ?? ""}
                                <span className="d-block">
                                  {supplier.postalCode ?? ""} {supplier.city ?? ""}
                                </span>
                              </>
                            }
                          />
                        ) : null}
                        {supplier.website ? (
                          <Champ
                            label="Site web"
                            value={
                              <a href={supplier.website} target="_blank" rel="noopener">
                                {supplier.website}
                              </a>
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                    {supplier.notes ? (
                      <div className="fiche-bloc fiche-bloc--slate">
                        <TitreSection
                          titre="Notes"
                          icone="bi-journal-text"
                          couleur="slate"
                          classes="mb-0"
                        />
                        <div className="fiche-grille">
                          <Champ label="Notes" value={supplier.notes} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
              {/* Ancien formulaire : le bloc des contacts (celui d'un logiciel) suit les faits. */}
              {legacy ? <Contacts sup={supplier} /> : null}
            </div>
            {rail ? (
              <div className="col-lg-3">
                {contratsEnCours.length ? (
                  <div className="data-card mb-3">
                    <div className="card-header-custom">
                      <h6 className="fw-bold mb-0 d-flex align-items-center">
                        <Icone
                          bi="bi-file-earmark-text"
                          taille="1em"
                          classes="ico-onglet ico-onglet--contrats"
                        />
                        Contrats en cours{" "}
                        <span className="badge bg-secondary ms-1">{contratsEnCours.length}</span>
                      </h6>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-nowrap"
                        data-ouvrir-onglet="contrats"
                      >
                        Tout voir
                      </button>
                    </div>
                    <div className="p-3">
                      <ul className="list-unstyled small mb-0 contrats-resume">
                        {contratsEnCours.map((c, i) => (
                          <li className={i < contratsEnCours.length - 1 ? "mb-2" : ""} key={c.id}>
                            <div className="d-flex justify-content-between align-items-center gap-2">
                              <a
                                href={`/contracts/${c.id}`}
                                className="fw-medium text-truncate"
                                title={c.name}
                              >
                                {c.name}
                              </a>
                              <StatusBadge status={contractStatus(c, seuils, today)} />
                            </div>
                            <div className="text-muted">
                              {c.endDate ? `échéance ${dateCourte(c.endDate)}` : ""}
                              {c.costYearly
                                ? `${c.endDate ? " · " : ""}${milliers(c.costYearly)} €/an`
                                : ""}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {certificats.length ? (
                  <div className="data-card mb-3">
                    <div className="card-header-custom">
                      <h6 className="fw-bold mb-0 d-flex align-items-center">
                        <Lucide
                          nom="shield-check"
                          taille={16}
                          classes={`me-2 ico-carte ico-${couleurIcone("bi-shield-check")}`}
                        />
                        Certificats{" "}
                        <span className="badge bg-secondary ms-1">{certificats.length}</span>
                      </h6>
                    </div>
                    <div className="p-3">
                      <ul className="list-unstyled small mb-0 contrats-resume">
                        {certificats.map((c, i) => (
                          <li className={i < certificats.length - 1 ? "mb-2" : ""} key={c.id}>
                            <div className="d-flex justify-content-between align-items-center gap-2">
                              <a
                                href={`/certificates/${c.id}`}
                                className="fw-medium text-truncate"
                                title={certificateLabel(c)}
                              >
                                {certificateLabel(c)}
                              </a>
                              <StatusBadge status={certificateStatus(c, seuils)} />
                            </div>
                            <div className="text-muted">
                              {CERT_KIND_LABELS[c.kind] ?? c.kind}
                              {c.expiryDate ? ` · échéance ${dateCourte(c.expiryDate)}` : ""}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {docsOn && pieces.length ? (
                  <div className="data-card mb-3">
                    <div className="card-header-custom">
                      <h6 className="fw-bold mb-0 d-flex align-items-center">
                        <Icone
                          bi="bi-paperclip"
                          taille="1em"
                          classes={`me-1 ico ico-${couleurIcone("bi-paperclip")}`}
                        />
                        Documents <span className="badge bg-secondary ms-1">{pieces.length}</span>
                      </h6>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-nowrap"
                        data-ouvrir-onglet="documents"
                      >
                        Tout voir
                      </button>
                    </div>
                    <div className="fiche-lies">
                      {pieces.slice(0, 6).map((d) => (
                        <Lien
                          key={d.id}
                          url={hasFile(d) ? `/documents/${d.id}/download` : "#vol-documents"}
                          icone="file-text"
                          nom={d.filename}
                          sous={
                            [d.category?.label, d.createdAt ? dateCourte(d.createdAt) : null]
                              .filter(Boolean)
                              .join(" · ") || undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                {software.length ? (
                  <div className="data-card mb-3">
                    <div className="card-header-custom">
                      <h6 className="fw-bold mb-0 d-flex align-items-center">
                        <Lucide nom="app-window" taille={16} classes="me-2 kind-icon--software" />
                        Logiciels fournis{" "}
                        <span className="badge bg-secondary ms-1">{software.length}</span>
                      </h6>
                    </div>
                    <div className="fiche-lies">
                      {software.map((sw) => (
                        <Lien
                          key={sw.id}
                          url={`/inventory/logiciels/${sw.id}`}
                          icone="app-window"
                          nom={sw.name}
                          teinte="software"
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                {equipments.length ? (
                  <div className="data-card mb-3">
                    <div className="card-header-custom">
                      <h6 className="fw-bold mb-0 d-flex align-items-center">
                        <Lucide nom="server" taille={16} classes="me-2 ico-carte ico-sky" />
                        Matériels fournis{" "}
                        <span className="badge bg-secondary ms-1">{equipments.length}</span>
                      </h6>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-nowrap"
                        data-ouvrir-onglet="materiel-couvert"
                      >
                        Tout voir
                      </button>
                    </div>
                    <div className="fiche-lies">
                      {equipments.map((e) => (
                        <Lien
                          key={e.id}
                          url={`/inventory/${e.id}`}
                          icone={EQUIPMENT_KIND_ICONS[e.kind ?? "vm"] ?? "server"}
                          nom={e.name}
                          sous={EQUIPMENT_KIND_LABELS[e.kind] ?? e.kind}
                          teinte={e.kind || "vm"}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Volet>

        {peutEditer ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormulaireFournisseur
                supplier={supplier}
                user={user}
                csrf={csrf}
                retour={`/suppliers/${id}#details`}
                dansFiche
              />
            </fieldset>
          </Volet>
        ) : null}

        <Volet cible="documents">
          <Documents
            parentKind="supplier"
            parentId={id}
            permission="suppliers"
            user={user}
            csrf={csrf}
          />
        </Volet>

        {equipments.length ? (
          <Volet cible="materiel-couvert">
            <div className="data-card mb-3">
              <div className="card-header-custom">
                <h6 className="fw-bold fiche-titre fiche-titre--slate mb-0">
                  <Icone
                    bi="bi-hdd-network"
                    taille={14}
                    classes={`ico ico-${couleurIcone("bi-hdd-network")}`}
                  />
                  Matériels fournis{" "}
                  <span className="badge bg-secondary ms-1">{equipments.length}</span>
                </h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Type</th>
                      <th>Environnement</th>
                      <th>Criticité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipments.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <a href={`/inventory/${e.id}`} className="fw-medium text-decoration-none">
                            {e.name}
                          </a>
                        </td>
                        <td className="small">{EQUIPMENT_KIND_LABELS[e.kind] ?? e.kind}</td>
                        <td className="small">
                          {e.environment
                            ? (ENVIRONMENT_LABELS[e.environment] ?? e.environment)
                            : "-"}
                        </td>
                        <td className="small">{e.criticality || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Volet>
        ) : null}

        {user.canView("domains") && domains.length ? (
          <Volet cible="domaines">
            <div className="data-card mb-3">
              <div className="card-header-custom">
                <h6 className="fw-bold fiche-titre fiche-titre--sky mb-0">
                  <Icone
                    bi="bi-globe"
                    taille={14}
                    classes={`ico ico-${couleurIcone("bi-globe")}`}
                  />
                  Domaines enregistrés{" "}
                  <span className="badge bg-secondary ms-1">{domains.length}</span>
                </h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Domaine</th>
                      <th className="text-nowrap">Expire le</th>
                      <th>Renouvellement</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <a href={`/domains/${d.id}`} className="fw-medium text-decoration-none">
                            {d.name}
                          </a>
                        </td>
                        <td className="small text-nowrap">
                          {d.expiryDate ? dateCourte(d.expiryDate) : "—"}
                        </td>
                        <td className="small">{d.autoRenew ? "Automatique" : "Manuel"}</td>
                        <td>
                          <StatusBadge status={domainStatus(d, seuils)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Volet>
        ) : null}

        {user.canView("accounts") && accounts.length ? (
          <Volet cible="comptes">
            <div className="data-card mb-3">
              <div className="card-header-custom">
                <h6 className="fw-bold fiche-titre fiche-titre--orange mb-0">
                  <Icone bi="bi-key" taille={14} classes={`ico ico-${couleurIcone("bi-key")}`} />
                  Comptes chez ce fournisseur{" "}
                  <span className="badge bg-secondary ms-1">{accounts.length}</span>
                </h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Utilisateur</th>
                      <th className="text-nowrap">Prochain changement</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <a href={`/accounts/${a.id}`} className="fw-medium text-decoration-none">
                            {a.serviceName}
                          </a>
                        </td>
                        <td className="small">{a.username}</td>
                        <td className="small text-nowrap">
                          {a.nextPasswordChange ? dateCourte(a.nextPasswordChange) : "—"}
                        </td>
                        <td>
                          <StatusBadge status={accountStatus(a, seuils)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Volet>
        ) : null}

        <Volet cible="contrats">
          <div className="data-card">
            <div className="card-header-custom">
              <h6 className="fw-bold fiche-titre fiche-titre--amber mb-0">
                <Icone
                  bi="bi-file-earmark-text"
                  taille={14}
                  classes={`ico ico-${couleurIcone("bi-file-earmark-text")}`}
                />
                Contrats <span className="badge bg-secondary ms-1">{contracts.length}</span>
              </h6>
            </div>
            <div className="table-responsive">
              <TableauContrats
                contracts={contracts}
                today={today}
                seuils={seuils}
                vide={
                  <tr>
                    <td colSpan={8} className="text-center py-3 text-muted">
                      Aucun contrat rattaché
                    </td>
                  </tr>
                }
              />
            </div>
          </div>
        </Volet>
      </Volets>
    </>
  );
}
