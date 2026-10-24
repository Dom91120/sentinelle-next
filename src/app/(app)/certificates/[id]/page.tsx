import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Documents } from "@/components/documents";
import {
  Activite,
  BandeauEcheance,
  BoutonModal,
  Entete,
  Historique,
  MenuPost,
  ModalAction,
} from "@/components/fiche";
import { Icone, Lucide } from "@/components/icones";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import { ScriptDiffere } from "@/components/scripts";
import {
  CERT_VALIDITY_LABELS,
  EQUIPMENT_KIND_ICONS,
  EQUIPMENT_KIND_LABELS,
} from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { couleurIcone } from "@/lib/navigation";
import {
  certificateHolderLabel,
  certificateMonitored,
  certificateStatus,
  softwareComputedStatus,
} from "@/lib/statuts";

/** Le nom de la fiche : le titulaire d'un certificat électronique, sinon le nom saisi. */
function nomCertificat(c: Parameters<typeof certificateHolderLabel>[0]) {
  return c.kind === "signature" ? certificateHolderLabel(c) || c.serviceName : c.serviceName;
}

import { formContext } from "@/modules/certificates/server";
import { FormCorps, Synthese } from "@/modules/certificates/vues";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { documentsEnabled, forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";
import { getActiveSnooze } from "@/server/snooze";

/** certificates/detail.html */
/** Le titre de l'onglet, comme le `{% block title %}` du gabarit Jinja. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idDeRoute((await params).id);
  const fiche = await prisma.certificate.findUnique({
    where: { id },
    select: {
      kind: true,
      serviceName: true,
      civility: true,
      holder: true,
      firstName: true,
      domain: true,
      expiryDate: true,
      validity: true,
      isActive: true,
    },
  });
  return { title: fiche ? `${nomCertificat(fiche)} - Sentinelle` : "Sentinelle" };
}

export default async function CertificateDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("certificates");
  const id = idDeRoute((await params).id);
  const cert = await prisma.certificate.findUnique({
    where: { id },
    include: {
      supplier: true,
      service: true,
      certUsage: true,
      support: true,
      equipment: true,
      registeredDomain: true,
      software: {
        include: { software: { include: { systemUpdates: { where: { isActive: true } } } } },
      },
    },
  });
  if (!cert) notFound();
  const { user, csrf, nonce } = page;
  const peutEditer = user.canEdit("certificates");
  const docsOn = documentsEnabled(user.settings);
  const [histories, voisins, ctx, snooze, pieces, tousLogiciels] = await Promise.all([
    prisma.certificateHistory.findMany({
      where: { certificateId: id },
      orderBy: { performedAt: "desc" },
    }),
    voisinsDe("certificate", id, "serviceName", page),
    peutEditer
      ? formContext()
      : Promise.resolve({
          equipments: [],
          suppliers: [],
          services: [],
          usageOptions: [],
          supportOptions: [],
        }),
    getActiveSnooze("certificate", id),
    docsOn ? forParent("certificate", id) : Promise.resolve([]),
    peutEditer && user.canView("software")
      ? prisma.software.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  // Les logiciels qui utilisent ce certificat : lien M:N, le même que sur la fiche logiciel.
  const logicielsOn = user.canView("software");
  const logiciels = logicielsOn
    ? cert.software
        .map((l) => l.software)
        .filter((sw) => sw.isActive)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    : [];
  const dejaLogiciels = new Set(logiciels.map((sw) => sw.id));
  const logicielsDisponibles = tousLogiciels.filter((sw) => !dejaLogiciels.has(sw.id));
  // Le matériel : un seul par certificat (le champ de la fiche) ; « Associer » le remplace.
  const materielOn = user.canView("inventory");
  const materiel = materielOn && cert.equipment?.isActive ? cert.equipment : null;
  const materielsDisponibles = ctx.equipments.filter((e) => e.id !== materiel?.id);
  const liaisonsOn = logicielsOn || materielOn;
  const nbLiaisons = logiciels.length + (materiel ? 1 : 0);
  const signature = cert.kind === "signature";
  const statut = certificateStatus(cert, seuilsDe(user.settings));
  const monitored = certificateMonitored(cert);
  const validityLabel = CERT_VALIDITY_LABELS[cert.validity ?? ""] ?? "Valide";
  const revocationCode = peutEditer ? cert.revocationCode : null;
  const sousTitre = signature
    ? `Certificat électronique · ${cert.serviceName}${cert.holderRole ? ` · ${cert.holderRole}` : ""}${validityLabel ? ` · ${validityLabel}` : ""}`
    : `Certificat TLS · ${cert.domain ?? ""}${cert.supplier || cert.issuer ? ` · ${cert.supplier ? cert.supplier.name : cert.issuer}` : ""}${cert.validity && cert.validity !== "valide" ? ` · ${validityLabel}` : ""}`;
  const complement = `${cert.issuedAt ? `émis le ${dateCourte(cert.issuedAt)}` : ""}${!signature ? `${cert.issuedAt ? " · " : ""}renouv. ${cert.autoRenew ? "automatique" : "manuel"}` : ""}`;
  const menu = [
    peutEditer && !signature && cert.domain ? (
      <MenuPost
        key="tls"
        url={`/certificates/${id}/check-tls`}
        libelle="Vérifier le TLS maintenant"
        icone="bi-shield-check"
        csrf={csrf}
      />
    ) : null,
  ];
  const revealJs = revocationCode
    ? `(function () { var btn = document.getElementById('revealCode'); var cible = document.getElementById('revocationCode'); if (!btn || !cible) return; btn.addEventListener('click', function () { cible.textContent = ${JSON.stringify(revocationCode)}; btn.remove(); }); })();`
    : null;
  return (
    <>
      <Entete
        titre={nomCertificat(cert)}
        sousTitre={sousTitre}
        statut={statut}
        primaire={
          peutEditer ? (
            <BoutonModal id="renouveler" libelle="Marquer renouvelé" icone="bi-arrow-repeat" />
          ) : null
        }
        menu={menu}
        voisins={voisins}
        base="/certificates"
        bandeau={
          <BandeauEcheance
            libelle="Expiration"
            date={cert.expiryDate}
            statut={monitored ? statut : null}
            passe="expiré depuis"
            debut={cert.issuedAt}
            complement={
              monitored ? complement : `hors surveillance : ${validityLabel.toLowerCase()}`
            }
            sansDate="date d'expiration à renseigner"
          />
        }
      />

      <BarreOnglets
        id="ficheCertificate"
        modifier={peutEditer ? `/certificates/${id}/edit` : null}
        surPlace
      >
        <Onglet cible="detail" libelle="Synthèse" icone="bi-card-text" actif />
        {peutEditer ? <Onglet cible="details" libelle="Détails" icone="bi-pencil-square" /> : null}
        {liaisonsOn ? (
          <Onglet
            cible="liaisons"
            libelle="Liaisons"
            icone="arrow-right-left"
            compteur={nbLiaisons}
          />
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
          cible="historique"
          libelle="Historique"
          icone="bi-clock-history"
          compteur={histories.length}
        />
      </BarreOnglets>

      <Volets>
        <Volet cible="detail" actif>
          <div className="row g-3">
            <div className="col-lg-9">
              <Synthese c={cert} revocationCode={revocationCode} />
            </div>
            <div className="col-lg-3">
              <Activite histories={histories} />
              <SnoozeCard
                entityType="certificate"
                entityId={id}
                user={user}
                snooze={snooze}
                csrf={csrf}
              />
            </div>
          </div>
        </Volet>

        {peutEditer ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormCorps
                certificate={cert}
                kind={cert.kind || "tls"}
                {...ctx}
                user={user}
                csrf={csrf}
                nonce={nonce}
                retour={`/certificates/${id}#details`}
                actionForm={`/certificates/${id}/edit`}
              />
            </fieldset>
          </Volet>
        ) : null}

        {liaisonsOn ? (
          <Volet cible="liaisons">
            <div className="cartes-collees">
              {logicielsOn ? (
                <div className="data-card mb-3">
                  <div className="card-header-custom">
                    <h6 className="fw-bold fiche-titre fiche-titre--slate mb-0">
                      <Icone
                        bi="bi-window-stack"
                        taille={14}
                        classes={`ico ico-${couleurIcone("bi-window-stack")}`}
                      />
                      Logiciels <span className="badge bg-secondary ms-1">{logiciels.length}</span>
                    </h6>
                  </div>
                  <div className="p-3">
                    {logiciels.length ? (
                      <ul className="list-unstyled mb-3 serveurs-liste">
                        {logiciels.map((sw) => (
                          <li
                            className="d-flex align-items-center justify-content-between gap-3"
                            key={sw.id}
                          >
                            <span className="d-flex align-items-center gap-2 min-w-0">
                              <Lucide
                                nom="app-window"
                                taille={16}
                                classes={`flex-shrink-0 statut-ico statut-ico--${softwareComputedStatus(sw, sw.systemUpdates)}`}
                              />
                              <a
                                href={`/inventory/logiciels/${sw.id}`}
                                className="fw-semibold text-decoration-none text-truncate"
                              >
                                {sw.name}
                              </a>
                            </span>
                            {peutEditer ? (
                              <form
                                method="POST"
                                action={`/certificates/${id}/software/${sw.id}/detach`}
                              >
                                <input type="hidden" name="csrf_token" value={csrf} />
                                <button
                                  type="submit"
                                  className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                                  title="Retirer"
                                  aria-label={`Retirer ${sw.name}`}
                                  data-confirm={`Retirer « ${sw.name} » des logiciels de ce certificat ?`}
                                >
                                  <Lucide nom="trash-2" taille={16} />
                                </button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted mb-3">Aucun logiciel rattaché.</p>
                    )}
                    {peutEditer ? (
                      <form
                        method="POST"
                        action={`/certificates/${id}/software`}
                        className="d-flex flex-wrap align-items-center gap-2"
                      >
                        <input type="hidden" name="csrf_token" value={csrf} />
                        <select
                          name="software_id"
                          id="certLogiciel"
                          className="form-select form-select-sm w-auto"
                          aria-label="Logiciel"
                          required
                          defaultValue=""
                        >
                          <option value="">Choisir un logiciel…</option>
                          {logicielsDisponibles.map((sw) => (
                            <option key={sw.id} value={sw.id}>
                              {sw.name}
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
              {materielOn ? (
                <div className="data-card mb-3">
                  <div className="card-header-custom">
                    <h6 className="fw-bold fiche-titre fiche-titre--slate mb-0">
                      <Icone
                        bi="bi-hdd-stack"
                        taille={14}
                        classes={`ico ico-${couleurIcone("bi-hdd-stack")}`}
                      />
                      Matériel <span className="badge bg-secondary ms-1">{materiel ? 1 : 0}</span>
                    </h6>
                  </div>
                  <div className="p-3">
                    {materiel ? (
                      <ul className="list-unstyled mb-3 serveurs-liste">
                        <li className="d-flex align-items-center justify-content-between gap-3">
                          <span className="d-flex align-items-center gap-2 min-w-0">
                            <Lucide
                              nom={EQUIPMENT_KIND_ICONS[materiel.kind ?? "vm"] ?? "server"}
                              taille={16}
                              classes={`flex-shrink-0 kind-icon kind-icon--${materiel.kind || "vm"}`}
                            />
                            <a
                              href={`/inventory/${materiel.id}`}
                              className="fw-semibold text-decoration-none text-truncate"
                              title={EQUIPMENT_KIND_LABELS[materiel.kind] ?? materiel.kind}
                            >
                              {materiel.name}
                            </a>
                          </span>
                          {peutEditer ? (
                            <form method="POST" action={`/certificates/${id}/equipment/detach`}>
                              <input type="hidden" name="csrf_token" value={csrf} />
                              <button
                                type="submit"
                                className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                                title="Retirer"
                                aria-label={`Retirer ${materiel.name}`}
                                data-confirm={`Détacher ce certificat de « ${materiel.name} » ?`}
                              >
                                <Lucide nom="trash-2" taille={16} />
                              </button>
                            </form>
                          ) : null}
                        </li>
                      </ul>
                    ) : (
                      <p className="text-muted mb-3">Aucun matériel rattaché.</p>
                    )}
                    {peutEditer ? (
                      <form
                        method="POST"
                        action={`/certificates/${id}/equipment`}
                        className="d-flex flex-wrap align-items-center gap-2"
                      >
                        <input type="hidden" name="csrf_token" value={csrf} />
                        <select
                          name="equipment_id"
                          id="certMateriel"
                          className="form-select form-select-sm w-auto"
                          aria-label="Matériel"
                          required
                          defaultValue=""
                        >
                          <option value="">
                            {materiel ? "Remplacer par…" : "Choisir un matériel…"}
                          </option>
                          {materielsDisponibles.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
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
            </div>
          </Volet>
        ) : null}

        {docsOn ? (
          <Volet cible="documents">
            <Documents
              parentKind="certificate"
              parentId={id}
              permission="certificates"
              user={user}
              csrf={csrf}
            />
          </Volet>
        ) : null}

        <Volet cible="historique">
          <Historique histories={histories} />
        </Volet>
      </Volets>

      {peutEditer ? (
        <ModalAction
          id="renouveler"
          titre="Marquer le certificat renouvelé"
          action={`/certificates/${id}/renew`}
          csrf={csrf}
          bouton="Marquer renouvelé"
          icone="bi-arrow-repeat"
          aide="Enregistre la nouvelle date d'expiration et garde l'ancienne dans l'historique."
        >
          <div className="mb-3">
            <label className="form-label" htmlFor="new_expiry_date">
              Nouvelle date d'expiration <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              name="new_expiry_date"
              id="new_expiry_date"
              className="form-control"
              required
            />
          </div>
          <div>
            <label className="form-label" htmlFor="renew_comment">
              Commentaire <span className="text-muted">(optionnel)</span>
            </label>
            <input
              type="text"
              name="comment"
              id="renew_comment"
              className="form-control"
              placeholder="ex : renouvelé chez Sectigo, 1 an"
            />
          </div>
        </ModalAction>
      ) : null}

      {revealJs ? <ScriptDiffere code={revealJs} nonce={nonce} /> : null}
    </>
  );
}
