/** Les gabarits des domaines (port de domains/_form_corps.html et _synthese.html). */

import { PiedForm, RubriqueForm } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { QaButton } from "@/components/quick-add";
import { ScriptDiffere } from "@/components/scripts";
import { Lu, LuBloc, Rangee, Rubrique } from "@/components/synthese";
import type { Domain, Supplier } from "@/generated/prisma/client";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { QaModalSupplier } from "@/modules/suppliers/vues";
import type { CurrentUser } from "@/server/guards";

export type DomaineComplet = Domain & { registrarSupplier: Supplier | null };

const LOOKUP_JS = `initLookupFill({
    btnId: 'checkRdapBtn', msgId: 'checkRdapMsg', inputId: 'domainInput',
    url: "/domains/check-rdap-domain", secondField: 'registrar',
    loadingText: 'Interrogation RDAP en cours…',
    successPrefix: 'Lu via RDAP : expire le'
});`;

export type FormProps = {
  domain: Domain | null;
  suppliers: Supplier[];
  user: CurrentUser;
  csrf: string;
  nonce?: string;
  retour: string;
  actionForm?: string;
};

/** domains/_form_corps.html */
export function FormCorps({ domain, suppliers, user, csrf, nonce, retour, actionForm }: FormProps) {
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
            <RubriqueForm titre="Domaine" icone="bi-globe" couleur="sky">
              <div className="row">
                <div className="col-md-8 mb-3">
                  <label className="form-label fw-medium">Nom de domaine *</label>
                  <div className="input-group">
                    <input
                      type="text"
                      name="name"
                      id="domainInput"
                      className="form-control"
                      defaultValue={domain?.name ?? ""}
                      required
                      placeholder="votredomaine.fr"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      id="checkRdapBtn"
                      title="Lire l'expiration via RDAP"
                    >
                      <Icone bi="bi-globe" taille="1em" /> Vérifier
                    </button>
                  </div>
                  <small id="checkRdapMsg" className="d-block mt-1" />
                </div>
              </div>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Registrar</label>
                  <input
                    type="text"
                    name="registrar"
                    className="form-control"
                    defaultValue={domain?.registrar ?? ""}
                    placeholder="OVH, Gandi, AFNIC..."
                  />
                  <small className="text-muted">Nom relevé au registre (RDAP).</small>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label fw-medium">Fiche fournisseur</label>
                  <div className="input-group">
                    <select
                      name="registrar_id"
                      id="registrarSupplier"
                      className="form-select"
                      defaultValue={domain?.registrarId ?? ""}
                    >
                      <option value="">— d'après le nom, ou aucune —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {user.canEdit("suppliers") ? (
                      <QaButton
                        modalId="qaModalSupplier"
                        targetId="registrarSupplier"
                        title="Ajouter un fournisseur"
                      />
                    ) : null}
                  </div>
                  <small className="text-muted">
                    Contacts et contrats du bureau d'enregistrement.
                  </small>
                </div>
                <div className="col-md-auto mb-3">
                  <label
                    className="form-label fw-medium"
                    title="Le dernier renouvellement (ou l'enregistrement), lu au registre par « Vérifier » : le début de la frise, jusqu'à l'expiration"
                  >
                    Renouvelé le
                  </label>
                  <input
                    type="date"
                    name="renewed_on"
                    className="form-control l-date"
                    defaultValue={domain?.renewedOn ? isoDate(domain.renewedOn) : ""}
                  />
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Date d'expiration</label>
                  <input
                    type="date"
                    name="expiry_date"
                    className="form-control l-date"
                    defaultValue={domain?.expiryDate ? isoDate(domain.expiryDate) : ""}
                  />
                </div>
              </div>
              <div className="mb-3">
                <div className="form-check form-switch">
                  <input
                    type="checkbox"
                    name="auto_renew"
                    className="form-check-input"
                    id="autoRenew"
                    defaultChecked={Boolean(domain?.autoRenew)}
                  />
                  <label className="form-check-label" htmlFor="autoRenew">
                    Renouvellement automatique chez le registrar
                  </label>
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
                  placeholder="Usage, contacts..."
                  defaultValue={domain?.description ?? ""}
                />
              </div>
            </RubriqueForm>
          </div>

          <PiedForm
            retour={retour}
            libelle={domain ? "Enregistrer" : "Ajouter"}
            supprimer={domain && user.canDelete("domains") ? `/domains/${domain.id}/delete` : null}
            confirmation="Supprimer ce domaine ?"
          />
        </form>
      </div>

      {user.canEdit("suppliers") ? <QaModalSupplier csrf={csrf} /> : null}
      <ScriptDiffere src="/js/lookup_fill.js" nonce={nonce} />
      <ScriptDiffere code={LOOKUP_JS} nonce={nonce} />
    </>
  );
}

/** domains/_synthese.html */
export function Synthese({ domain }: { domain: DomaineComplet }) {
  return (
    <div
      className="data-card mb-3 synthese synthese--cases"
      style={{ "--lu-intitule": "75px" } as React.CSSProperties}
    >
      <Rubrique titre="Domaine" bi="bi-globe" couleur="sky">
        <Rangee>
          <LuBloc label="Registrar">
            {domain.registrarSupplier ? (
              <a
                href={`/suppliers/${domain.registrarId}`}
                title={
                  domain.registrar && domain.registrar !== domain.registrarSupplier.name
                    ? `${domain.registrar} au registre`
                    : undefined
                }
              >
                {domain.registrarSupplier.name}
              </a>
            ) : domain.registrar ? (
              <span title="sans fiche fournisseur">{domain.registrar}</span>
            ) : null}
          </LuBloc>
          <Lu
            label="Renouv."
            valeur={domain.autoRenew ? "Automatique" : "Manuel"}
            titre="Renouvellement"
          />
          <Lu
            label="Renouvelé le"
            valeur={domain.renewedOn ? dateCourte(domain.renewedOn) : null}
            titre="Dernier renouvellement (ou enregistrement), lu au registre"
          />
          <Lu label="Expire le" valeur={domain.expiryDate ? dateCourte(domain.expiryDate) : null} />
        </Rangee>
      </Rubrique>

      <Rubrique titre="Notes" bi="bi-journal-text" couleur="slate">
        <Rangee>
          <Lu label="Notes" valeur={domain.description} large />
        </Rangee>
      </Rubrique>
    </div>
  );
}
