import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Documents } from "@/components/documents";
import {
  Activite,
  BandeauEcheance,
  BoutonModal,
  Entete,
  Historique,
  MenuLien,
  MenuPost,
  ModalAction,
} from "@/components/fiche";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import { ScriptDiffere } from "@/components/scripts";
import { CERT_VALIDITY_LABELS } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { certificateHolderLabel, certificateMonitored, certificateStatus } from "@/lib/statuts";
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
    select: { serviceName: true },
  });
  return { title: fiche ? `${fiche.serviceName} - Sentinelle` : "Sentinelle" };
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
    },
  });
  if (!cert) notFound();
  const { user, csrf, nonce } = page;
  const peutEditer = user.canEdit("certificates");
  const docsOn = documentsEnabled(user.settings);
  const [histories, voisins, ctx, snooze, pieces] = await Promise.all([
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
  ]);
  const signature = cert.kind === "signature";
  const statut = certificateStatus(cert, seuilsDe(user.settings));
  const monitored = certificateMonitored(cert);
  const validityLabel = CERT_VALIDITY_LABELS[cert.validity ?? ""] ?? "Valide";
  const revocationCode = peutEditer ? cert.revocationCode : null;
  const sousTitre = signature
    ? `Certificat électronique · ${certificateHolderLabel(cert)}${cert.holderRole ? ` · ${cert.holderRole}` : ""}${validityLabel ? ` · ${validityLabel}` : ""}`
    : `Certificat TLS · ${cert.domain ?? ""}${cert.supplier || cert.issuer ? ` · ${cert.supplier ? cert.supplier.name : cert.issuer}` : ""}${cert.validity && cert.validity !== "valide" ? ` · ${validityLabel}` : ""}`;
  const complement = `${cert.issuedAt ? `émis le ${dateCourte(cert.issuedAt)}` : ""}${!signature ? `${cert.issuedAt ? " · " : ""}renouv. ${cert.autoRenew ? "automatique" : "manuel"}` : ""}`;
  const menu = [
    <MenuLien
      key="pdf"
      url={`/certificates/${id}/pdf`}
      libelle="Exporter en PDF"
      icone="bi-file-earmark-pdf"
    />,
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
        titre={cert.serviceName}
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
