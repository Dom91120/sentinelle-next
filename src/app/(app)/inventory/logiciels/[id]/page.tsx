import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Documents } from "@/components/documents";
import { CarteEditeur, Champ, Entete, TitreSection } from "@/components/fiche";
import { Icone, Lucide } from "@/components/icones";
import { StatusBadge } from "@/components/macros";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import {
  QaModalContract,
  QaModalEquipment,
  QaModalServer,
  QaModalSupplier,
} from "@/components/quick-add";
import { EQUIPMENT_KIND_ICONS, EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { couleurIcone } from "@/lib/navigation";
import {
  accountStatus,
  certificateHolderLabel,
  certificateLabel,
  certificateStatus,
  contractEnCours,
  contractStatus,
  linkSensDepuis,
  reviewComputedStatus,
  softwareComputedStatus,
  softwareOverLicence,
  testComputedStatus,
  updateStatusColor,
} from "@/lib/statuts";
import { FormulaireLogiciel, rattachementsDe } from "@/modules/software/form-page";
import {
  authModeLabel,
  criticalityLabel,
  formContext,
  gdprLocationLabel,
  hostingLabel,
  lifecycleLabel,
  marchesRattachables,
  sourceTypeLabel,
} from "@/modules/software/server";
import { Contacts, type Flux, FluxCarte, Partages, Synthese } from "@/modules/software/vues";
import { Consultations, Contrats } from "@/modules/software/vues-contrats";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { docCategories, documentsEnabled, forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";
import { getActiveSnooze } from "@/server/snooze";

function euros(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** software/detail.html */
/** Le titre de l'onglet, comme le `{% block title %}` du gabarit Jinja. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idDeRoute((await params).id);
  const fiche = await prisma.software.findUnique({ where: { id }, select: { name: true } });
  return { title: fiche ? `${fiche.name} - Sentinelle` : "Sentinelle" };
}

export default async function SoftwareDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("software");
  const id = idDeRoute((await params).id);
  const item = await prisma.software.findUnique({
    where: { id },
    include: {
      supplier: true,
      technology: true,
      systemUpdates: { where: { isActive: true } },
      contracts: { include: { contract: { include: { kindRef: true, supplier: true } } } },
      consultations: {
        include: { quotes: { include: { supplier: true } } },
        orderBy: [{ date: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      },
      accessReviews: { where: { isActive: true } },
      accounts: { where: { isActive: true } },
      equipments: { include: { equipment: true } },
      certificates: { include: { certificate: true } },
      userServices: { include: { userService: true }, orderBy: { userServiceId: "asc" } },
      linksOut: { include: { target: true }, orderBy: { id: "asc" } },
      linksIn: { include: { source: true }, orderBy: { id: "asc" } },
      shares: { orderBy: { label: "asc" } },
      tasks: { where: { isActive: true } },
    },
  });
  if (!item) notFound();
  const { user, csrf, nonce, features } = page;
  const peutEditer = user.canEdit("software");
  const seuils = seuilsDe(user.settings);
  const docsOn = documentsEnabled(user.settings);
  const legacy = user.settings.SOFTWARE_FORM_LEGACY;
  const [
    voisins,
    ctx,
    rattachables,
    autres,
    tousLesServices,
    tousEquipements,
    tousCertificats,
    snooze,
    pieces,
    categories,
    rattachements,
  ] = await Promise.all([
    voisinsDe("software", id, "name", page),
    peutEditer
      ? formContext()
      : prisma.supplier
          .findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
          .then((suppliers) => ({
            suppliers,
            contracts: [],
            equipments: [],
            technologies: [],
            userServices: [],
          })),
    marchesRattachables(item),
    prisma.software.findMany({
      where: { isActive: true, id: { not: id } },
      orderBy: { name: "asc" },
    }),
    prisma.userService.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    features.certificates && user.canView("certificates")
      ? prisma.certificate.findMany({
          where: { isActive: true },
          orderBy: [{ serviceName: "asc" }, { domain: "asc" }],
        })
      : Promise.resolve([]),
    getActiveSnooze("software", id),
    docsOn ? forParent("software", id) : Promise.resolve([]),
    docCategories(),
    rattachementsDe(prisma, id),
  ]);
  const marches = item.contracts
    .map((l) => l.contract)
    .filter((c) => c.isActive)
    .sort((a, b) => {
      const ka = a.endDate ? 1 : 0;
      const kb = b.endDate ? 1 : 0;
      if (ka !== kb) return kb - ka;
      return (b.endDate?.getTime() ?? 0) - (a.endDate?.getTime() ?? 0);
    });
  const marchesEnCours = marches.filter((c) => contractEnCours(c));
  const docsBruts = docsOn
    ? await prisma.document.findMany({
        where: { contractId: { in: marches.map((c) => c.id) } },
        include: { category: true },
        orderBy: [{ docDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      })
    : [];
  const docsParMarche = new Map<number, typeof docsBruts>();
  for (const d of docsBruts)
    if (d.contractId)
      docsParMarche.set(d.contractId, [...(docsParMarche.get(d.contractId) ?? []), d]);
  const equipments = item.equipments.map((l) => l.equipment);
  const deja = new Set(equipments.map((e) => e.id));
  const serveursDisponibles = tousEquipements.filter((e) => !deja.has(e.id));
  // Les certificats du logiciel ne se montrent qu'avec le module et le droit de les voir.
  const certificatsOn = features.certificates && user.canView("certificates");
  const certificats = certificatsOn
    ? item.certificates
        .map((l) => l.certificate)
        .filter((c) => c.isActive)
        .sort((a, b) => a.serviceName.localeCompare(b.serviceName, "fr"))
    : [];
  const dejaCertificats = new Set(certificats.map((c) => c.id));
  // Le nom court, celui de la liste Certificats : le titulaire d'un certificat
  // électronique, sinon le nom ; le libellé complet reste en infobulle.
  const nomCertificat = (c: Parameters<typeof certificateLabel>[0]) =>
    c.kind === "signature" ? certificateHolderLabel(c) || c.serviceName : c.serviceName;
  const certificatsDisponibles = tousCertificats.filter((c) => !dejaCertificats.has(c.id));
  const userServices = item.userServices.map((l) => l.userService);
  const servicesLies = new Set(userServices.map((s) => s.id));
  const flux: Flux[] = [
    ...item.linksOut.map((l) => ({ lien: l, sens: linkSensDepuis(l, id), autre: l.target })),
    ...item.linksIn.map((l) => ({ lien: l, sens: linkSensDepuis(l, id), autre: l.source })),
  ];
  const updates = item.systemUpdates;
  const taches = item.tasks;
  const revues = item.accessReviews;
  const comptes = item.accounts;
  const statut = softwareComputedStatus(item, updates);
  const nbLiaisons =
    (features.links ? flux.length : 0) +
    equipments.length +
    certificats.length +
    userServices.length;
  const over = softwareOverLicence(item);
  const sup = item.supplier;
  // L'éditeur se lit à droite, sous les boutons de navigation ; le sous-titre garde le reste.
  const sousTitre = [
    item.version ? `v${item.version}` : null,
    lifecycleLabel(item).toLowerCase(),
    `${hostingLabel(item).toLowerCase()}${item.isDocker ? " (Docker)" : ""}`,
    item.criticality ? `criticité ${criticalityLabel(item).toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const editeur = item.internalDev ? (
    "Développement interne"
  ) : sup ? (
    <>
      Édité par{" "}
      <a href={`/suppliers/${item.supplierId}`} className="fw-medium text-decoration-none">
        {sup.name}
      </a>
    </>
  ) : (
    "Éditeur inconnu"
  );
  const titre = (
    <>
      {item.name}
      {item.url ? (
        <>
          {" "}
          <a
            href={item.url}
            target="_blank"
            rel="noopener"
            className="titre-lien"
            title={`Ouvrir l'application (${item.url})`}
            aria-label="Ouvrir l'application"
          >
            <Icone bi="bi-box-arrow-up-right" taille="0.65em" />
          </a>
        </>
      ) : null}
    </>
  );
  const totalAnnuel = marchesEnCours.reduce((a, c) => a + (c.costYearly ?? 0), 0);
  const colGauche = sup || marchesEnCours.length || nbLiaisons ? "col-lg-9" : "col-12";
  return (
    <>
      <Entete
        titre={titre}
        sousTitre={sousTitre}
        statut={statut}
        voisins={voisins}
        base="/inventory/logiciels"
        sousActions={editeur}
      />

      {over ? (
        <div className="alert alert-warning py-2 px-3 small">
          <Icone bi="bi-exclamation-triangle" taille="1em" classes="me-1" />
          <strong>Dépassement de licence</strong> : {item.usersCount} utilisateurs pour un plafond
          contractuel de {item.usersMax}.
        </div>
      ) : null}

      <BarreOnglets
        id="ficheLogiciel"
        modifier={peutEditer ? `/inventory/logiciels/${id}/edit` : null}
        surPlace
      >
        <Onglet cible="detail" libelle="Synthèse" icone="bi-card-text" actif />
        {peutEditer ? <Onglet cible="details" libelle="Détails" icone="bi-pencil-square" /> : null}
        <Onglet cible="contacts" libelle="Contacts" icone="contact-round" />
        <Onglet
          cible="liaisons"
          libelle="Liaisons"
          icone="arrow-right-left"
          compteur={nbLiaisons}
        />
        {user.canView("contracts") ? (
          <>
            <Onglet
              cible="contrats"
              libelle="Contrats"
              icone="bi-file-earmark-text"
              compteur={marches.length}
            />
            {features.quotes ? (
              <Onglet
                cible="devis"
                libelle="Devis"
                icone="banknote"
                compteur={item.consultations.length}
              />
            ) : null}
          </>
        ) : null}
        {docsOn ? (
          <Onglet
            cible="documents"
            libelle="Documents"
            icone="bi-paperclip"
            compteur={pieces.length}
          />
        ) : null}
        <Onglet
          cible="suivi"
          libelle="Suivi"
          icone="bi-activity"
          compteur={updates.length + taches.length + revues.length + comptes.length}
        />
      </BarreOnglets>

      <Volets>
        <Volet cible="detail" actif>
          <div className="row g-3">
            <div className={colGauche}>
              {!legacy ? (
                <Synthese item={item} gdpr={features.gdpr} />
              ) : (
                <div className="data-card p-3 mb-3">
                  <div className="fiche-sections">
                    <div className="fiche-bloc fiche-bloc--indigo">
                      <TitreSection
                        titre="Identité"
                        icone="bi-window-stack"
                        couleur="indigo"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ label="Version" value={item.version} />
                        <Champ
                          label="Mise en service"
                          value={item.serviceDate ? dateCourte(item.serviceDate) : null}
                        />
                        <Champ
                          label="URL / accès"
                          value={
                            item.url ? (
                              <a href={item.url} target="_blank" rel="noopener">
                                {item.url}
                              </a>
                            ) : null
                          }
                        />
                      </div>
                    </div>
                    <div className="fiche-bloc fiche-bloc--sky">
                      <TitreSection
                        titre="Hébergement & nature"
                        icone="bi-cloud"
                        couleur="sky"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ
                          label="Hébergement"
                          value={`${hostingLabel(item)}${item.isDocker ? " — Docker" : ""}`}
                        />
                        <Champ label="Type de source" value={sourceTypeLabel(item)} />
                      </div>
                    </div>
                    <div className="fiche-bloc fiche-bloc--violet">
                      <TitreSection
                        titre="Qualification"
                        icone="bi-sliders"
                        couleur="violet"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ label="Criticité" value={criticalityLabel(item)} />
                        <Champ
                          label="Technologie"
                          value={item.technology ? item.technology.label : null}
                        />
                      </div>
                    </div>
                    <div className="fiche-bloc fiche-bloc--teal">
                      <TitreSection
                        titre="Authentification & utilisateurs"
                        icone="bi-person-lock"
                        couleur="teal"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ
                          label="Authentification"
                          value={
                            <>
                              {authModeLabel(item) || "Non renseignée"}
                              {item.authStrong ? (
                                <span className="badge bg-success-subtle text-success ms-1">
                                  2FA
                                </span>
                              ) : null}
                            </>
                          }
                        />
                        <Champ
                          label="Utilisateurs"
                          value={
                            item.usersCount === null
                              ? "Non comptés"
                              : `${item.usersCount}${item.usersMax ? ` / ${item.usersMax}` : ""}`
                          }
                        />
                      </div>
                    </div>
                    <div className="fiche-bloc fiche-bloc--emerald">
                      <TitreSection
                        titre="Référents"
                        icone="bi-people"
                        couleur="emerald"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ
                          label="Référent métier"
                          value={
                            item.responsible || item.responsibleEmail ? (
                              <>
                                {item.responsible ?? ""}
                                {item.responsibleEmail ? (
                                  <a
                                    href={`mailto:${item.responsibleEmail}`}
                                    className="d-block small text-truncate"
                                  >
                                    <Icone bi="bi-envelope" taille="1em" classes="me-1" />
                                    {item.responsibleEmail}
                                  </a>
                                ) : null}
                              </>
                            ) : null
                          }
                        />
                        <Champ
                          label="Référent technique"
                          value={
                            item.techResponsible || item.techResponsibleEmail ? (
                              <>
                                {item.techResponsible ?? ""}
                                {item.techResponsibleEmail ? (
                                  <a
                                    href={`mailto:${item.techResponsibleEmail}`}
                                    className="d-block small text-truncate"
                                  >
                                    <Icone bi="bi-envelope" taille="1em" classes="me-1" />
                                    {item.techResponsibleEmail}
                                  </a>
                                ) : null}
                              </>
                            ) : null
                          }
                        />
                      </div>
                    </div>
                    {features.gdpr ? (
                      <div className="fiche-bloc fiche-bloc--amber">
                        <TitreSection
                          titre="Données personnelles (RGPD)"
                          icone="bi-shield-lock"
                          couleur="amber"
                          classes="mb-0"
                        />
                        <div className="fiche-grille">
                          {item.gdprPersonalData ? (
                            <>
                              <Champ label="Catégories" value={item.gdprCategories} />
                              <Champ label="Réf. registre" value={item.gdprRegistryRef} />
                              <Champ label="Localisation" value={gdprLocationLabel(item)} />
                              {sup && (sup.dpoContact || sup.dpoEmail) ? (
                                <Champ
                                  label="DPO de l'éditeur"
                                  value={
                                    <>
                                      {sup.dpoContact ?? ""}
                                      {sup.dpoEmail ? (
                                        <a
                                          href={`mailto:${sup.dpoEmail}`}
                                          className="d-block small text-truncate"
                                        >
                                          {sup.dpoEmail}
                                        </a>
                                      ) : null}
                                    </>
                                  }
                                />
                              ) : null}
                            </>
                          ) : (
                            <Champ
                              label="Traitement"
                              value={<span className="text-muted">Aucune donnée personnelle</span>}
                            />
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div className="fiche-bloc fiche-bloc--rose">
                      <TitreSection
                        titre="Description"
                        icone="bi-journal-text"
                        couleur="rose"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ label="Notes" value={item.description ?? ""} large />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {sup || marchesEnCours.length || nbLiaisons ? (
              <div className="col-lg-3">
                <div className="fiche-cote">
                  <CarteEditeur sup={sup} role="Éditeur" />

                  {marchesEnCours.length ? (
                    <div className="data-card mb-3">
                      <div className="card-header-custom">
                        <h6 className="fw-bold mb-0 d-flex align-items-center">
                          <Icone
                            bi="bi-file-earmark-text"
                            taille="1em"
                            classes="ico-onglet ico-onglet--contrats"
                          />
                          Contrats
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
                          {marchesEnCours.map((c, i) => (
                            <li className={i < marchesEnCours.length - 1 ? "mb-2" : ""} key={c.id}>
                              <div className="d-flex justify-content-between align-items-center gap-2">
                                <a
                                  href={`/contracts/${c.id}`}
                                  className="fw-medium text-truncate"
                                  title={c.name}
                                >
                                  {c.reference || c.name}
                                </a>
                                <StatusBadge status={contractStatus(c, seuils)} />
                              </div>
                              <div className="text-muted">
                                {c.reference ? c.name : ""}
                                {c.endDate
                                  ? `${c.reference ? " · " : ""}échéance ${dateCourte(c.endDate)}`
                                  : ""}
                                {c.costYearly ? ` · ${euros(c.costYearly)} €/an` : ""}
                              </div>
                            </li>
                          ))}
                        </ul>
                        {totalAnnuel ? (
                          <div className="d-flex justify-content-between small border-top mt-2 pt-2">
                            <span className="text-muted">Total annuel</span>
                            <span className="fw-medium">{euros(totalAnnuel)} €</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {nbLiaisons ? (
                    <div className="data-card mb-3">
                      <div className="card-header-custom">
                        <h6 className="fw-bold mb-0 d-flex align-items-center">
                          <Lucide
                            nom="arrow-right-left"
                            taille={16}
                            classes="ico-onglet ico-vert"
                          />
                          Liaisons <span className="badge bg-secondary ms-1">{nbLiaisons}</span>
                        </h6>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-nowrap"
                          data-ouvrir-onglet="liaisons"
                        >
                          Tout voir
                        </button>
                      </div>
                      <div className="p-3 small liaisons-resume">
                        {userServices.length ? (
                          <div className="liaisons-groupe">
                            <div className="liaisons-titre">Services</div>
                            <div>
                              {userServices
                                .map((s) => s.name)
                                .sort()
                                .join(", ")}
                            </div>
                          </div>
                        ) : null}
                        {equipments.length ? (
                          <div className="liaisons-groupe">
                            <div className="liaisons-titre">Serveurs</div>
                            <ul className="list-unstyled mb-0">
                              {equipments.map((e) => (
                                <li className="d-flex align-items-center gap-2" key={e.id}>
                                  <Lucide
                                    nom={EQUIPMENT_KIND_ICONS[e.kind ?? "vm"] ?? "server"}
                                    taille={14}
                                    classes={`flex-shrink-0 kind-icon--${e.kind || "vm"}`}
                                  />
                                  <a
                                    href={`/inventory/${e.id}`}
                                    className="text-truncate liaison-serveur"
                                    title={EQUIPMENT_KIND_LABELS[e.kind] ?? e.kind}
                                  >
                                    {e.name}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {certificats.length ? (
                          <div className="liaisons-groupe">
                            <div className="liaisons-titre">Certificats</div>
                            <ul className="list-unstyled mb-0">
                              {certificats.map((c) => (
                                <li className="d-flex align-items-center gap-2" key={c.id}>
                                  <Lucide
                                    nom="shield-check"
                                    taille={14}
                                    classes={`flex-shrink-0 statut-ico statut-ico--${certificateStatus(c, seuils)}`}
                                  />
                                  <a
                                    href={`/certificates/${c.id}`}
                                    className="text-truncate"
                                    title={certificateLabel(c)}
                                  >
                                    {nomCertificat(c)}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {features.links && flux.length ? (
                          <div className="liaisons-groupe">
                            <div className="liaisons-titre">Flux</div>
                            <ul className="list-unstyled mb-0">
                              {flux.map(({ lien, sens, autre }) => (
                                <li className="d-flex align-items-center gap-2" key={lien.id}>
                                  <Lucide
                                    nom={
                                      {
                                        sortant: "arrow-right",
                                        entrant: "arrow-left",
                                        double: "arrow-right-left",
                                      }[sens]
                                    }
                                    taille={14}
                                    classes="flex-shrink-0 ico-vert"
                                  />
                                  <a
                                    href={`/inventory/logiciels/${autre.id}`}
                                    className="text-truncate liaison-serveur"
                                    title={`${{ sortant: "Flux sortant vers", entrant: "Flux entrant depuis", double: "Flux à double sens avec" }[sens]} ${autre.name}`}
                                  >
                                    {autre.name}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </Volet>

        {peutEditer ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormulaireLogiciel
                item={item}
                ctx={ctx}
                page={page}
                retour={`/inventory/logiciels/${id}#details`}
                rattachements={rattachements}
                dansFiche
              />
            </fieldset>
          </Volet>
        ) : null}

        <Volet cible="contacts">
          <Contacts sup={sup} />
        </Volet>

        <Volet cible="liaisons">
          <div className="cartes-collees">
            <div className="data-card mb-3">
              <div className="card-header-custom">
                <h6 className="fw-bold fiche-titre fiche-titre--emerald mb-0">
                  <Icone
                    bi="bi-people"
                    taille={14}
                    classes={`ico ico-${couleurIcone("bi-people")}`}
                  />
                  Services utilisateurs{" "}
                  <span className="badge bg-secondary ms-1">{servicesLies.size}</span>
                </h6>
              </div>
              <form
                method="POST"
                action={`/inventory/logiciels/${id}/services`}
                className="p-3"
                data-edition-visible
              >
                <fieldset className="edition-verrou" data-edition-verrou disabled>
                  <input type="hidden" name="csrf_token" value={csrf} />
                  {tousLesServices.length ? (
                    <div className="services-grille">
                      {tousLesServices.map((sv) => (
                        <label
                          className="d-flex align-items-center gap-2 mb-1 small"
                          key={sv.id}
                          title={`${sv.contactName ?? ""}${sv.contactEmail ? ` — ${sv.contactEmail}` : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            name="user_service_ids"
                            value={sv.id}
                            defaultChecked={servicesLies.has(sv.id)}
                            disabled={!peutEditer}
                            data-soumettre-au-changement
                          />
                          <span>{sv.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">
                      Aucun service utilisateur dans les Référentiels.
                    </span>
                  )}
                </fieldset>
              </form>
            </div>

            <div className="data-card mb-3">
              <div className="card-header-custom">
                <h6 className="fw-bold fiche-titre fiche-titre--slate mb-0">
                  <Icone
                    bi="bi-hdd-stack"
                    taille={14}
                    classes={`ico ico-${couleurIcone("bi-hdd-stack")}`}
                  />
                  Serveurs <span className="badge bg-secondary ms-1">{equipments.length}</span>
                </h6>
              </div>
              <div className="p-3">
                {equipments.length ? (
                  <ul className="list-unstyled mb-3 serveurs-liste">
                    {equipments.map((e) => (
                      <li
                        className="d-flex align-items-center justify-content-between gap-3"
                        key={e.id}
                      >
                        <span className="d-flex align-items-center gap-2 min-w-0">
                          <Lucide
                            nom="server"
                            taille={16}
                            classes={`serveur-ico flex-shrink-0 ico-${couleurIcone("bi-hdd-stack")}`}
                          />
                          <a
                            href={`/inventory/${e.id}`}
                            className="fw-semibold text-decoration-none"
                          >
                            {e.name}
                          </a>
                        </span>
                        {peutEditer ? (
                          <form
                            method="POST"
                            action={`/inventory/logiciels/${id}/servers/${e.id}/detach`}
                          >
                            <input type="hidden" name="csrf_token" value={csrf} />
                            <button
                              type="submit"
                              className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                              title="Retirer"
                              aria-label={`Retirer ${e.name}`}
                              data-confirm={`Retirer « ${e.name} » des serveurs de ce logiciel ?`}
                            >
                              <Lucide nom="trash-2" taille={16} />
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : item.noServer ? (
                  <p className="text-muted mb-3">
                    Aucun serveur : le logiciel tourne chez l'éditeur ou sur les postes des agents.
                  </p>
                ) : (
                  <p className="text-muted mb-3">Aucun serveur renseigné.</p>
                )}
                {peutEditer ? (
                  <form
                    method="POST"
                    action={`/inventory/logiciels/${id}/servers`}
                    className="d-flex flex-wrap align-items-center gap-2"
                  >
                    <input type="hidden" name="csrf_token" value={csrf} />
                    <select
                      name="equipment_id"
                      id="swServeur"
                      className="form-select form-select-sm w-auto"
                      aria-label="Serveur"
                      required
                      defaultValue=""
                    >
                      <option value="">Choisir un serveur…</option>
                      {serveursDisponibles.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    {user.canEdit("inventory") ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary btn-carre"
                        title="Créer un serveur absent du parc"
                        aria-label="Créer un serveur absent du parc"
                        data-bs-toggle="modal"
                        data-bs-target="#qaModalServer"
                        data-qa-open="qaModalServer"
                        data-qa-target="swServeur"
                      >
                        <span aria-hidden="true" className="btn-carre-plus">
                          ➕
                        </span>
                      </button>
                    ) : null}
                    <button type="submit" className="btn btn-sm btn-outline-secondary">
                      <Lucide nom="plus" taille={14} classes="me-1" />
                      Associer
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            {certificatsOn ? (
              <div className="data-card mb-3">
                <div className="card-header-custom">
                  <h6 className="fw-bold fiche-titre fiche-titre--slate mb-0">
                    <Icone
                      bi="bi-award"
                      taille={14}
                      classes={`ico ico-${couleurIcone("bi-award")}`}
                    />
                    Certificats{" "}
                    <span className="badge bg-secondary ms-1">{certificats.length}</span>
                  </h6>
                </div>
                <div className="p-3">
                  {certificats.length ? (
                    <ul className="list-unstyled mb-3 serveurs-liste">
                      {certificats.map((c) => (
                        <li
                          className="d-flex align-items-center justify-content-between gap-3"
                          key={c.id}
                        >
                          <span className="d-flex align-items-center gap-2 min-w-0">
                            <Lucide
                              nom="shield-check"
                              taille={16}
                              classes={`flex-shrink-0 statut-ico statut-ico--${certificateStatus(c, seuils)}`}
                            />
                            <a
                              href={`/certificates/${c.id}`}
                              className="fw-semibold text-decoration-none text-truncate"
                              title={certificateLabel(c)}
                            >
                              {nomCertificat(c)}
                            </a>
                          </span>
                          {peutEditer ? (
                            <form
                              method="POST"
                              action={`/inventory/logiciels/${id}/certificates/${c.id}/detach`}
                            >
                              <input type="hidden" name="csrf_token" value={csrf} />
                              <button
                                type="submit"
                                className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                                title="Retirer"
                                aria-label={`Retirer ${c.serviceName}`}
                                data-confirm={`Retirer « ${c.serviceName} » des certificats de ce logiciel ?`}
                              >
                                <Lucide nom="trash-2" taille={16} />
                              </button>
                            </form>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted mb-3">Aucun certificat renseigné.</p>
                  )}
                  {peutEditer ? (
                    <form
                      method="POST"
                      action={`/inventory/logiciels/${id}/certificates`}
                      className="d-flex flex-wrap align-items-center gap-2"
                    >
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <select
                        name="certificate_id"
                        id="swCertificat"
                        className="form-select form-select-sm w-auto"
                        aria-label="Certificat"
                        required
                        defaultValue=""
                      >
                        <option value="">Choisir un certificat…</option>
                        {certificatsDisponibles.map((c) => (
                          <option key={c.id} value={c.id}>
                            {certificateLabel(c)}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn btn-sm btn-outline-secondary">
                        <Lucide nom="plus" taille={14} classes="me-1" />
                        Associer
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ) : null}

            {features.links ? (
              <FluxCarte
                item={item}
                flux={flux}
                autres={autres}
                user={user}
                csrf={csrf}
                nonce={nonce}
              />
            ) : null}
            <SnoozeCard
              entityType="software"
              entityId={id}
              user={user}
              snooze={snooze}
              csrf={csrf}
            />
          </div>
        </Volet>

        {user.canView("contracts") ? (
          <>
            <Volet cible="contrats">
              <Contrats
                item={item}
                marches={marches}
                rattachables={rattachables}
                docsParMarche={docsParMarche}
                docCategories={categories}
                documentsEnabled={docsOn}
                seuils={seuils}
                user={user}
                csrf={csrf}
              />
            </Volet>
            {features.quotes ? (
              <Volet cible="devis">
                <Consultations
                  item={item}
                  consultations={item.consultations}
                  suppliers={ctx.suppliers}
                  user={user}
                  csrf={csrf}
                />
              </Volet>
            ) : null}
          </>
        ) : null}

        <Volet cible="suivi">
          <div className="cartes-collees">
            <div className="data-card">
              <div className="card-header-custom">
                <h6 className="fw-bold fiche-titre fiche-titre--sky mb-0">
                  <Icone
                    bi="bi-arrow-up-circle"
                    taille={14}
                    classes={`ico ico-${couleurIcone("bi-arrow-up-circle")}`}
                  />
                  Mises à jour liées{" "}
                  <span className="badge bg-secondary ms-1">{updates.length}</span>
                </h6>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Élément</th>
                      <th>Version</th>
                      <th>Statut</th>
                      <th>Dernière MAJ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {updates.length ? (
                      updates.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <a href={`/updates/${u.id}`} className="text-decoration-none">
                              {u.name}
                            </a>
                          </td>
                          <td className="small">
                            {u.currentVersion || "-"}
                            {u.latestVersion && u.latestVersion !== u.currentVersion
                              ? ` → ${u.latestVersion}`
                              : ""}
                          </td>
                          <td>
                            <StatusBadge status={updateStatusColor(u)} />
                          </td>
                          <td className="small text-nowrap">
                            {u.lastUpdate ? dateCourte(u.lastUpdate) : "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="text-center py-3 text-muted">
                          Aucune mise à jour rattachée
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {user.canView("tests") ? (
              <div className="data-card">
                <div className="card-header-custom">
                  <h6 className="fw-bold fiche-titre fiche-titre--teal mb-0">
                    <Icone
                      bi="bi-clipboard-check"
                      taille={14}
                      classes={`ico ico-${couleurIcone("bi-clipboard-check")}`}
                    />
                    Tâches récurrentes{" "}
                    <span className="badge bg-secondary ms-1">{taches.length}</span>
                  </h6>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Tâche</th>
                        <th>Type</th>
                        <th>Prochaine</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taches.length ? (
                        taches.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <a href={`/tests/${t.id}`} className="text-decoration-none">
                                {t.name}
                              </a>
                            </td>
                            <td className="small">{t.testType}</td>
                            <td className="small text-nowrap">
                              {t.nextDue ? dateCourte(t.nextDue) : "—"}
                            </td>
                            <td>
                              <StatusBadge status={testComputedStatus(t, seuils)} fallback="test" />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-3 text-muted">
                            Aucune tâche rattachée
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {user.canView("reviews") ? (
              <div className="data-card">
                <div className="card-header-custom">
                  <h6 className="fw-bold fiche-titre fiche-titre--violet mb-0">
                    <Icone
                      bi="bi-person-check"
                      taille={14}
                      classes={`ico ico-${couleurIcone("bi-person-check")}`}
                    />
                    Revues de droits{" "}
                    <span className="badge bg-secondary ms-1">{revues.length}</span>
                  </h6>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Revue</th>
                        <th>Responsable</th>
                        <th>Prochaine</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revues.length ? (
                        revues.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <a href={`/reviews/${r.id}`} className="text-decoration-none">
                                {r.application}
                              </a>
                            </td>
                            <td className="small">{r.responsible || "—"}</td>
                            <td className="small text-nowrap">
                              {r.nextReview ? dateCourte(r.nextReview) : "—"}
                            </td>
                            <td>
                              <StatusBadge
                                status={reviewComputedStatus(r, seuils)}
                                fallback="review"
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-3 text-muted">
                            Aucune revue de droits rattachée
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {user.canView("accounts") ? (
              <div className="data-card">
                <div className="card-header-custom">
                  <h6 className="fw-bold fiche-titre fiche-titre--orange mb-0">
                    <Icone bi="bi-key" taille={14} classes={`ico ico-${couleurIcone("bi-key")}`} />
                    Comptes <span className="badge bg-secondary ms-1">{comptes.length}</span>
                  </h6>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Utilisateur</th>
                        <th>Prochain changement</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comptes.length ? (
                        comptes.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <a href={`/accounts/${a.id}`} className="text-decoration-none">
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
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-3 text-muted">
                            Aucun compte rattaché
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </Volet>

        {docsOn ? (
          <Volet cible="documents">
            <div className="cartes-collees">
              <Documents
                parentKind="software"
                parentId={id}
                permission="software"
                user={user}
                csrf={csrf}
                title="Documents"
              />
              <Partages item={item} partages={item.shares} user={user} csrf={csrf} nonce={nonce} />
            </div>
          </Volet>
        ) : null}
      </Volets>

      {user.canEdit("inventory") ? <QaModalServer csrf={csrf} /> : null}
      {peutEditer ? (
        <>
          {user.canEdit("suppliers") ? <QaModalSupplier csrf={csrf} /> : null}
          {legacy && user.canEdit("contracts") ? <QaModalContract csrf={csrf} /> : null}
          {legacy && user.canEdit("inventory") ? <QaModalEquipment csrf={csrf} /> : null}
        </>
      ) : null}
    </>
  );
}
