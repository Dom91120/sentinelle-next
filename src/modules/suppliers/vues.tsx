/** Les gabarits des fournisseurs (port de suppliers/_form_corps.html, _synthese.html). */

import { PiedForm, Section } from "@/components/formulaire";
import { Lu, LuBloc, Rangee, Rubrique } from "@/components/synthese";
import type { Supplier } from "@/generated/prisma/client";
import { SUPPLIER_KIND_LABELS } from "@/lib/constantes";
import { Contacts } from "@/modules/software/vues";
import { kindLabel } from "@/modules/suppliers/server";
import type { CurrentUser } from "@/server/guards";

export type FormProps = {
  supplier: Supplier | null;
  user: CurrentUser;
  csrf: string;
  retour: string;
};

function Champ({
  label,
  name,
  valeur,
  type = "text",
  placeholder,
  requis = false,
  titre,
}: {
  label: string;
  name: string;
  valeur: string | null | undefined;
  type?: string;
  placeholder?: string;
  requis?: boolean;
  titre?: string;
}) {
  return (
    <div>
      <label className="form-label small mb-1" htmlFor={`fs-${name}`} title={titre}>
        {label}
        {requis ? (
          <>
            {" "}
            <span className="text-danger">*</span>
          </>
        ) : null}
      </label>
      <input
        type={type}
        name={name}
        id={`fs-${name}`}
        className="form-control form-control-sm"
        defaultValue={valeur ?? ""}
        placeholder={placeholder}
        required={requis}
      />
    </div>
  );
}

/** Un contact : le rôle en tête de ligne, puis ses trois champs. */
function Contact({
  role,
  prefix,
  nom,
  tel,
  mail,
}: {
  role: string;
  prefix: string;
  nom: string | null | undefined;
  tel: string | null | undefined;
  mail: string | null | undefined;
}) {
  const champs: [string, string, string | null | undefined, string][] = [
    ["contact", "Nom", nom, "text"],
    ["phone", "Téléphone", tel, "text"],
    ["email", "Courriel", mail, "email"],
  ];
  return (
    <div className="grille grille-contact">
      <span className="contact-role">{role}</span>
      {champs.map(([suffixe, intitule, valeur, type]) => (
        <div key={suffixe}>
          <label
            className="form-label small mb-1 contact-label"
            htmlFor={`fs-${prefix}_${suffixe}`}
          >
            {intitule}
          </label>
          <input
            type={type}
            name={`${prefix}_${suffixe}`}
            id={`fs-${prefix}_${suffixe}`}
            className="form-control form-control-sm"
            defaultValue={valeur ?? ""}
            aria-label={`${role} — ${intitule.toLowerCase()}`}
          />
        </div>
      ))}
    </div>
  );
}

/** suppliers/_form_corps.html */
export function FormCorps({ supplier: s, user, csrf, retour }: FormProps) {
  return (
    <div className="form-seul">
      <form
        method="POST"
        id="form-principal"
        className="formulaire fournisseur-saisie"
        data-edition-visible
        action={s ? `/suppliers/${s.id}/edit` : "/suppliers/create"}
      >
        <input type="hidden" name="csrf_token" value={csrf} />

        <div className="data-card mb-3">
          <Rubrique titre="Fournisseur" bi="bi-building" couleur="indigo">
            <div className="grille grille-identite">
              <Champ
                label="Nom"
                name="name"
                valeur={s?.name}
                placeholder="ex : Dell, OVH, SSII locale…"
                requis
              />
              <div>
                <label className="form-label small mb-1" htmlFor="fs-kind">
                  Type
                </label>
                <select
                  name="kind"
                  id="fs-kind"
                  className="form-select form-select-sm"
                  defaultValue={s?.kind ?? "editor"}
                >
                  {Object.entries(SUPPLIER_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <Champ
                label="Site web"
                name="website"
                valeur={s?.website}
                type="url"
                placeholder="https://…"
              />
            </div>
            <div className="grille grille-adresse">
              <Champ label="Adresse" name="address" valeur={s?.address} />
              <Champ label="Code postal" name="postal_code" valeur={s?.postalCode} />
              <Champ label="Ville" name="city" valeur={s?.city} />
            </div>
          </Rubrique>

          {/* Le même intitulé que le bloc Contacts de la synthèse : l'assistance, puis les contacts. */}
          <Rubrique titre="Contacts" bi="bi-person-lines-fill" couleur="rose" onglet="contacts">
            <div className="grille grille-3">
              <Champ label="Interlocuteur" name="contact_name" valeur={s?.contactName} />
              <Champ label="Courriel" name="email" valeur={s?.email} type="email" />
              <Champ label="Standard" name="phone" valeur={s?.phone} />
            </div>
            <div className="grille grille-3">
              <Champ
                label="Tickets (URL)"
                name="support_url"
                valeur={s?.supportUrl}
                type="url"
                placeholder="https://support.exemple.fr"
              />
              <Champ label="Hotline" name="support_phone" valeur={s?.supportPhone} />
              <Champ label="Courriel" name="support_email" valeur={s?.supportEmail} type="email" />
            </div>
            <div className="grille grille-3">
              <Champ
                label="N° client / identifiant support"
                name="customer_ref"
                valeur={s?.customerRef}
                titre="Celui que l'éditeur redemande à chaque appel"
              />
              <Champ
                label="Horaires"
                name="hours"
                valeur={s?.hours}
                placeholder="ex : lundi au vendredi 8h-17h"
              />
              <Champ
                label="Horaires (2e ligne)"
                name="hours2"
                valeur={s?.hours2}
                placeholder="ex : samedi 8h-12h"
              />
            </div>
            <div className="grille grille-contact contact-entete" aria-hidden="true">
              <span />
              <span className="form-label small mb-0">Nom</span>
              <span className="form-label small mb-0">Téléphone</span>
              <span className="form-label small mb-0">Courriel</span>
            </div>
            <Contact
              role="Commercial 1"
              prefix="commercial"
              nom={s?.commercialContact}
              tel={s?.commercialPhone}
              mail={s?.commercialEmail}
            />
            <Contact
              role="Commercial 2"
              prefix="commercial2"
              nom={s?.commercialContact2}
              tel={s?.commercialPhone2}
              mail={s?.commercialEmail2}
            />
            <Contact
              role="Administratif"
              prefix="admin"
              nom={s?.adminContact}
              tel={s?.adminPhone}
              mail={s?.adminEmail}
            />
            <Contact
              role="DPO"
              prefix="dpo"
              nom={s?.dpoContact}
              tel={s?.dpoPhone}
              mail={s?.dpoEmail}
            />
          </Rubrique>

          <Rubrique titre="Notes" bi="bi-journal-text" couleur="slate">
            <textarea
              name="notes"
              id="fs-notes"
              className="form-control form-control-sm"
              rows={3}
              aria-label="Notes"
              placeholder="Procédure d'ouverture de ticket, escalade, infos contrat…"
              defaultValue={s?.notes ?? ""}
            />
          </Rubrique>
        </div>

        <PiedForm
          retour={retour}
          libelle={s ? "Enregistrer" : "Ajouter"}
          supprimer={s && user.canDelete("suppliers") ? `/suppliers/${s.id}/delete` : null}
          confirmation="Supprimer ce fournisseur ?"
        />
      </form>
    </div>
  );
}

function _BlocContact({
  titre,
  prefix,
  aide,
  nom,
  tel,
  mail,
  icone,
  couleur,
}: {
  titre: string;
  prefix: string;
  aide?: string;
  nom: string | null | undefined;
  tel: string | null | undefined;
  mail: string | null | undefined;
  icone: string;
  couleur: string;
}) {
  return (
    <Section titre={titre} icone={icone} couleur={couleur} aide={aide}>
      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label fw-medium">Nom</label>
          <input
            type="text"
            name={`${prefix}_contact`}
            className="form-control"
            defaultValue={nom ?? ""}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label fw-medium">Téléphone</label>
          <input
            type="text"
            name={`${prefix}_phone`}
            className="form-control"
            defaultValue={tel ?? ""}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label fw-medium">Email</label>
          <input
            type="email"
            name={`${prefix}_email`}
            className="form-control"
            defaultValue={mail ?? ""}
          />
        </div>
      </div>
    </Section>
  );
}

function sansProtocole(url: string): string {
  return url.replace("https://", "").replace("http://", "");
}

/** Un contact de la Synthèse : ses champs coulent dans la grille, chaque contact sur une nouvelle ligne. */

/** suppliers/_synthese.html */
export function Synthese({ supplier: s }: { supplier: Supplier }) {
  return (
    <div className="cartes-collees">
      <div
        className="data-card mb-3 synthese synthese--cases"
        style={{ "--lu-intitule": "80px" } as React.CSSProperties}
      >
        <Rubrique titre="Fournisseur" bi="bi-building" couleur="indigo">
          <Rangee>
            <Lu label="Nom" valeur={s.name} />
            <Lu label="Type" valeur={kindLabel(s)} />
            <LuBloc label="Site Internet">
              {s.website ? (
                <a
                  href={s.website}
                  target="_blank"
                  rel="noopener"
                  className="text-truncate d-block"
                >
                  {sansProtocole(s.website)}
                </a>
              ) : null}
            </LuBloc>
          </Rangee>
          <Rangee>
            <LuBloc label="Adresse" pleine>
              {s.address || s.postalCode || s.city
                ? `${s.address ?? ""}${s.address && (s.postalCode || s.city) ? ", " : ""}${s.postalCode ?? ""} ${s.city ?? ""}`
                : null}
            </LuBloc>
          </Rangee>
        </Rubrique>
      </div>

      {/* Entre l'identité et les notes : le même bloc que l'onglet Contacts d'un logiciel
          (SoftInventory), assistance puis contacts. */}
      <Contacts sup={s} titre="Contacts" seulementRenseigne />

      <div
        className="data-card mb-3 synthese synthese--cases"
        style={{ "--lu-intitule": "80px" } as React.CSSProperties}
      >
        <Rubrique titre="Notes" bi="bi-journal-text" couleur="slate">
          <Rangee>
            <Lu label="Notes" valeur={s.notes} large />
          </Rangee>
        </Rubrique>
      </div>
    </div>
  );
}

/** suppliers/form.html : la grille. */
export function FormulaireFournisseur({ supplier, user, csrf, retour }: FormProps) {
  return <FormCorps supplier={supplier} user={user} csrf={csrf} retour={retour} />;
}
