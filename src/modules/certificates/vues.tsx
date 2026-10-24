/** Les gabarits des certificats (port de certificates/_form_corps.html et _synthese.html). */

import { PiedForm, RubriqueForm } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { EquipmentSelect } from "@/components/partials";
import { ScriptDiffere } from "@/components/scripts";
import { euros, Lu, LuBloc, Rangee, Rubrique } from "@/components/synthese";
import type {
  Certificate,
  Domain,
  Equipment,
  Referential,
  Supplier,
  UserService,
} from "@/generated/prisma/client";
import { CERT_VALIDITY_LABELS, CIVILITY_LABELS, EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import {
  certificateHolderLabel,
  certificateSupportLabel,
  certificateUsageLabel,
} from "@/lib/statuts";
import type { FormContext } from "@/modules/certificates/server";
import type { CurrentUser } from "@/server/guards";

export type CertificatComplet = Certificate & {
  supplier: Supplier | null;
  service: UserService | null;
  certUsage: Referential | null;
  support: Referential | null;
  equipment: Equipment | null;
  registeredDomain: Domain | null;
};

const NATURE_JS = `(function () {
  var type = document.getElementById('certKind');
  if (!type) return;
  function appliquer() {
    document.querySelectorAll('#form-principal [data-nature]').forEach(function (bloc) {
      var actif = bloc.dataset.nature === type.value;
      bloc.hidden = !actif;
      bloc.querySelectorAll('input, select, textarea, button').forEach(function (champ) { champ.disabled = !actif; });
    });
  }
  function usages(auChangement) {
    var liste = document.getElementById('certUsage');
    if (!liste) return;
    Array.prototype.forEach.call(liste.options, function (o) {
      var portee = o.dataset.portee;
      var ok = !portee || portee === 'tous' || portee === type.value;
      if (!ok && o.selected && !auChangement) ok = true;
      o.hidden = !ok;
      o.disabled = !ok;
    });
    if (liste.selectedOptions[0] && liste.selectedOptions[0].disabled) liste.value = '';
  }
  type.addEventListener('change', function () { appliquer(); usages(true); });
  appliquer();
  usages(false);
})();`;

const LOOKUP_JS = `initLookupFill({
  btnId: 'checkTlsBtn', msgId: 'checkTlsMsg', inputId: 'domainInput',
  url: "/certificates/check-domain", secondField: 'issuer',
  loadingText: 'Lecture du certificat en cours…',
  successPrefix: 'Certificat lu : expire le'
});`;

export type FormProps = FormContext & {
  certificate: Certificate | null;
  kind: string;
  user: CurrentUser;
  csrf: string;
  nonce?: string;
  retour: string;
  actionForm?: string;
};

/** certificates/_form_corps.html */
export function FormCorps({
  certificate,
  kind,
  equipments,
  suppliers,
  services,
  usageOptions,
  supportOptions,
  user,
  csrf,
  nonce,
  retour,
  actionForm,
}: FormProps) {
  const signature = kind === "signature";
  const c = certificate;
  const nature = (type: "tls" | "signature") => ({
    "data-nature": type,
    hidden: (type === "signature") !== signature || undefined,
  });
  return (
    <>
      <div className="form-seul">
        <form
          method="POST"
          id="form-principal"
          className="formulaire fiche-saisie"
          data-edition-visible
          action={actionForm}
        >
          <input type="hidden" name="csrf_token" value={csrf} />
          <div className="data-card mb-3">
            <RubriqueForm titre="Certificat" icone="bi-patch-check" couleur="sky">
              <div className="row">
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium" htmlFor="certKind">
                    Type
                  </label>
                  <select
                    name="kind"
                    id="certKind"
                    className="form-select l-contenu"
                    defaultValue={signature ? "signature" : "tls"}
                  >
                    <option value="tls">Serveur (TLS)</option>
                    <option value="signature">Nominatif (personne ou service)</option>
                  </select>
                </div>
                <div className="col-md mb-3" {...nature("tls")}>
                  <label className="form-label fw-medium">Nom *</label>
                  <input
                    type="text"
                    name="service_name"
                    className="form-control"
                    defaultValue={c?.serviceName ?? ""}
                    required
                    placeholder="ex: Site web, API, VPN..."
                  />
                </div>
                <div className="col-md mb-3" {...nature("tls")}>
                  <label className="form-label fw-medium">Domaine *</label>
                  <div className="input-group">
                    <input
                      type="text"
                      name="domain"
                      id="domainInput"
                      className="form-control"
                      defaultValue={c?.domain ?? ""}
                      required
                      placeholder="exemple.votredomaine.fr"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      id="checkTlsBtn"
                      title="Lire le certificat du domaine"
                    >
                      <Icone bi="bi-shield-check" taille="1em" /> Vérifier
                    </button>
                  </div>
                  <small id="checkTlsMsg" className="d-block mt-1" />
                  <input type="hidden" name="issuer" defaultValue={c?.issuer ?? ""} />
                </div>
                <div className="col-md-auto mb-3" {...nature("signature")}>
                  <label className="form-label fw-medium">Civilité</label>
                  <select
                    name="civility"
                    className="form-select l-contenu"
                    defaultValue={c?.civility ?? ""}
                  >
                    <option value="">—</option>
                    {Object.entries(CIVILITY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md mb-3" {...nature("signature")}>
                  <label className="form-label fw-medium">Nom *</label>
                  <input
                    type="text"
                    name="holder"
                    className="form-control"
                    required
                    defaultValue={c?.holder ?? ""}
                    data-ad-search
                    data-ad-email="holder_email"
                    placeholder="ARNAUD, ou SERVEUR CLIENT RGS"
                  />
                </div>
                <div className="col-md mb-3" {...nature("signature")}>
                  <label className="form-label fw-medium">Prénom</label>
                  <input
                    type="text"
                    name="first_name"
                    className="form-control"
                    defaultValue={c?.firstName ?? ""}
                  />
                </div>
                <div className="col-md mb-3" {...nature("signature")}>
                  <label className="form-label fw-medium">Email</label>
                  <input
                    type="email"
                    name="holder_email"
                    className="form-control"
                    defaultValue={c?.holderEmail ?? ""}
                  />
                </div>
              </div>
              <div className="row" {...nature("signature")}>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Service utilisateur</label>
                  <select
                    name="service_id"
                    className="form-select l-contenu"
                    defaultValue={c?.serviceId ?? ""}
                  >
                    <option value="">— Aucun —</option>
                    {services.map((sv) => (
                      <option key={sv.id} value={sv.id}>
                        {sv.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md mb-3">
                  <label className="form-label fw-medium">Fonction</label>
                  <input
                    type="text"
                    name="holder_role"
                    className="form-control"
                    defaultValue={c?.holderRole ?? ""}
                    placeholder="Maire, Adjoint, DGA, Agent..."
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md mb-3">
                  <label className="form-label fw-medium" title="Autorité de certification">
                    Émetteur
                  </label>
                  <select
                    name="supplier_id"
                    className="form-select"
                    defaultValue={c?.supplierId ?? ""}
                  >
                    <option value="">— Sélectionner —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md mb-3">
                  <label className="form-label fw-medium">Support</label>
                  <select
                    name="support_id"
                    className="form-select"
                    defaultValue={c?.supportId ?? ""}
                  >
                    <option value="">— Non renseigné —</option>
                    {supportOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md mb-3">
                  <label className="form-label fw-medium">Usage</label>
                  <select
                    name="usage_id"
                    id="certUsage"
                    className="form-select"
                    defaultValue={c?.usageId ?? ""}
                  >
                    <option value="">— Non renseigné —</option>
                    {usageOptions.map((u) => (
                      <option key={u.id} value={u.id} data-portee={u.scope || "tous"}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md mb-3" {...nature("signature")}>
                  <label
                    className="form-label fw-medium"
                    title="Intitulé du certificat chez l'autorité, niveau de garantie compris"
                  >
                    Intitulé
                  </label>
                  <input
                    type="text"
                    name="level"
                    className="form-control"
                    defaultValue={c?.level ?? ""}
                    placeholder="Décideur - G2, RGS**..."
                  />
                </div>
                <div className="col-md mb-3">
                  <label className="form-label fw-medium">N° de série</label>
                  <input
                    type="text"
                    name="serial_number"
                    className="form-control"
                    defaultValue={c?.serialNumber ?? ""}
                  />
                </div>
                <div className="w-100" {...nature("signature")} />
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium" title="Date d'émission">
                    Émis le
                  </label>
                  <input
                    type="date"
                    name="issued_at"
                    className="form-control l-date"
                    defaultValue={isoDate(c?.issuedAt)}
                  />
                </div>
                <div className="col-md-auto mb-3">
                  <label
                    className="form-label fw-medium"
                    title="Date d'expiration. Laissée vide, la fiche passe en orange : à compléter."
                  >
                    Expire le
                  </label>
                  <input
                    type="date"
                    name="expiry_date"
                    className="form-control l-date"
                    defaultValue={isoDate(c?.expiryDate)}
                  />
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium" title="« Expiré » se déduit de la date.">
                    Validité
                  </label>
                  <select
                    name="validity"
                    className="form-select l-contenu"
                    defaultValue={c?.validity ?? "valide"}
                  >
                    {Object.entries(CERT_VALIDITY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-auto mb-3" {...nature("signature")}>
                  <label
                    className="form-label fw-medium"
                    title="Durée commandée, en années. Ce qui a été commandé ; les dates disent ce qui a été délivré."
                  >
                    Durée (ans)
                  </label>
                  <input
                    type="number"
                    name="duration_years"
                    className="form-control l-jours"
                    min={0}
                    max={10}
                    defaultValue={c?.durationYears ?? ""}
                  />
                </div>
                <div className="col-md-auto mb-3" {...nature("signature")}>
                  <label className="form-label fw-medium" title="Montant TTC, en euros">
                    Montant TTC
                  </label>
                  <input
                    type="text"
                    name="amount_ttc"
                    className="form-control l-montant"
                    inputMode="decimal"
                    defaultValue={c?.amountTtc ?? ""}
                  />
                </div>
                <div className="col-md-auto mb-3" {...nature("signature")}>
                  <label className="form-label fw-medium" title="Imputation budgétaire">
                    Imputation
                  </label>
                  <input
                    type="text"
                    name="budget_code"
                    className="form-control l-montant"
                    defaultValue={c?.budgetCode ?? ""}
                    placeholder="60632"
                  />
                </div>
                <div className="col-md mb-3" {...nature("signature")}>
                  <label className="form-label fw-medium">Code de révocation</label>
                  <input
                    type="text"
                    name="revocation_code"
                    className="form-control"
                    autoComplete="off"
                    placeholder={
                      c?.revocationCode
                        ? "enregistré — laisser vide pour le garder"
                        : "code remis par l’autorité"
                    }
                  />
                  <div className="form-text">
                    Il invalide le certificat — un secret. Saisir <code>-</code> pour l'effacer.
                  </div>
                </div>
                <div className="col-md-auto mb-3" {...nature("tls")}>
                  <span className="form-label d-none d-md-block" aria-hidden="true">
                    &nbsp;
                  </span>
                  <div className="form-check form-switch saisie-interrupteur">
                    <input
                      type="checkbox"
                      name="auto_renew"
                      className="form-check-input"
                      id="autoRenew"
                      defaultChecked={Boolean(c?.autoRenew)}
                    />
                    <label className="form-check-label" htmlFor="autoRenew">
                      Auto-renouvellement
                    </label>
                  </div>
                </div>
                <div className="col-md mb-3" {...nature("tls")}>
                  <EquipmentSelect
                    equipments={equipments}
                    selectedId={c?.equipmentId}
                    compact
                    user={user}
                    csrf={csrf}
                  />
                </div>
              </div>
            </RubriqueForm>

            <RubriqueForm titre="Notes" icone="bi-journal-text" couleur="slate">
              <div className="mb-3">
                <label className="form-label fw-medium">Description / Notes</label>
                <textarea
                  name="description"
                  className="form-control"
                  rows={3}
                  placeholder="Informations complémentaires..."
                  defaultValue={c?.description ?? ""}
                />
              </div>
            </RubriqueForm>
          </div>

          <PiedForm
            retour={retour}
            libelle={c ? "Enregistrer" : "Ajouter"}
            supprimer={c && user.canDelete("certificates") ? `/certificates/${c.id}/delete` : null}
            confirmation="Supprimer ce certificat ?"
          />
        </form>
      </div>

      <ScriptDiffere code={NATURE_JS} nonce={nonce} />
      <ScriptDiffere src="/js/lookup_fill.js" nonce={nonce} />
      <ScriptDiffere code={LOOKUP_JS} nonce={nonce} />
    </>
  );
}

/** certificates/_synthese.html */
export function Synthese({
  c,
  revocationCode,
}: {
  c: CertificatComplet;
  revocationCode: string | null;
}) {
  const signature = c.kind === "signature";
  const validite = CERT_VALIDITY_LABELS[c.validity ?? ""] ?? "Valide";
  return (
    <div
      className="data-card mb-3 synthese synthese--cases"
      style={{ "--lu-intitule": "75px" } as React.CSSProperties}
    >
      {signature ? (
        <Rubrique titre="Certificat" bi="bi-patch-check" couleur="sky">
          <Rangee>
            <Lu label="Nom" valeur={certificateHolderLabel(c)} />
            <LuBloc label="Courriel">
              {c.holderEmail ? (
                <a href={`mailto:${c.holderEmail}`} className="text-truncate d-block">
                  {c.holderEmail}
                </a>
              ) : null}
            </LuBloc>
            <Lu label="Service" valeur={c.service?.name ?? null} titre="Service utilisateur" />
            <Lu label="Fonction" valeur={c.holderRole} />
          </Rangee>
          <Rangee>
            <LuBloc label="Émetteur" titre="Autorité de certification">
              {c.supplier ? <a href={`/suppliers/${c.supplierId}`}>{c.supplier.name}</a> : null}
            </LuBloc>
            <Lu label="Usage" valeur={certificateUsageLabel(c)} />
            <Lu label="Support" valeur={certificateSupportLabel(c)} />
            <Lu label="Intitulé" valeur={c.level} />
            <Lu label="N° de série" valeur={c.serialNumber} />
          </Rangee>
          <Rangee>
            <Lu label="Émis le" valeur={c.issuedAt ? dateCourte(c.issuedAt) : null} />
            <Lu label="Expire le" valeur={c.expiryDate ? dateCourte(c.expiryDate) : null} />
            <Lu label="Validité" valeur={validite} />
            <Lu
              label="Durée"
              valeur={
                c.durationYears ? `${c.durationYears} an${c.durationYears > 1 ? "s" : ""}` : null
              }
              titre="Durée commandée"
            />
            <Lu label="Montant TTC" valeur={euros(c.amountTtc)} />
            <Lu label="Imputation" valeur={c.budgetCode} titre="Imputation budgétaire" />
            <LuBloc label="Équipement" facultatif>
              {c.equipment ? (
                <a
                  href={`/inventory/${c.equipment.id}`}
                  title={EQUIPMENT_KIND_LABELS[c.equipment.kind] ?? c.equipment.kind}
                >
                  {c.equipment.name}
                </a>
              ) : null}
            </LuBloc>
          </Rangee>
        </Rubrique>
      ) : (
        <Rubrique titre="Certificat" bi="bi-patch-check" couleur="sky">
          <Rangee>
            <Lu label="Nom d'hôte" valeur={c.domain} />
            <LuBloc label="Domaine">
              {c.registeredDomain ? (
                <a href={`/domains/${c.domainId}`}>{c.registeredDomain.name}</a>
              ) : (
                <span className="text-muted fw-normal" title="hors du référentiel des domaines">
                  hors référentiel
                </span>
              )}
            </LuBloc>
            <LuBloc label="Émetteur">
              {c.supplier ? (
                <a href={`/suppliers/${c.supplierId}`}>{c.supplier.name}</a>
              ) : (
                c.issuer || null
              )}
            </LuBloc>
            <Lu label="Support" valeur={certificateSupportLabel(c)} />
            <Lu label="Usage" valeur={certificateUsageLabel(c)} />
            <Lu label="N° de série" valeur={c.serialNumber} />
          </Rangee>
          <Rangee>
            <Lu label="Émis le" valeur={c.issuedAt ? dateCourte(c.issuedAt) : null} />
            <Lu label="Expire le" valeur={c.expiryDate ? dateCourte(c.expiryDate) : null} />
            <Lu label="Validité" valeur={validite} />
            <Lu
              label="Renouv."
              valeur={c.autoRenew ? "Automatique" : "Manuel"}
              titre="Renouvellement"
            />
            <LuBloc label="Équipement" facultatif>
              {c.equipment ? (
                <a
                  href={`/inventory/${c.equipment.id}`}
                  title={EQUIPMENT_KIND_LABELS[c.equipment.kind] ?? c.equipment.kind}
                >
                  {c.equipment.name}
                </a>
              ) : null}
            </LuBloc>
          </Rangee>
        </Rubrique>
      )}

      <Rubrique titre="Notes" bi="bi-journal-text" couleur="slate">
        <Rangee>
          <Lu label="Notes" valeur={c.description} large />
        </Rangee>
      </Rubrique>

      {revocationCode ? (
        <div className="p-3 border-top">
          <small className="text-muted">Code de révocation</small>
          <div className="d-flex align-items-center gap-2">
            <code id="revocationCode" className="fs-6">
              ••••••••
            </code>
            <button type="button" className="btn btn-sm btn-outline-secondary" id="revealCode">
              <Icone bi="bi-eye" taille="1em" classes="me-1" /> Afficher
            </button>
            <small className="text-muted">
              Il invalide le certificat — perte, vol, départ du titulaire.
            </small>
          </div>
        </div>
      ) : null}
    </div>
  );
}
