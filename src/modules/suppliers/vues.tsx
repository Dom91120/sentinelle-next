/** Les gabarits des fournisseurs (port de suppliers/_form_corps.html, _form_corps_ancien.html, _synthese.html). */

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

function BlocContact({
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

/** suppliers/_form_corps_ancien.html (SUPPLIER_FORM_LEGACY) */
export function FormCorpsAncien({ supplier, user, csrf, retour }: FormProps) {
  const v = (x: string | null | undefined) => x ?? "";
  return (
    <form
      method="POST"
      id="form-principal"
      className="formulaire"
      data-edition-visible
      action={supplier ? `/suppliers/${supplier.id}/edit` : "/suppliers/create"}
    >
      <input type="hidden" name="csrf_token" value={csrf} />
      <Section titre="Identité" icone="bi-building" couleur="indigo">
        <div className="row g-3">
          <div className="col-md-5">
            <label className="form-label fw-medium">Nom *</label>
            <input
              type="text"
              name="name"
              className="form-control"
              required
              defaultValue={supplier?.name ?? ""}
              placeholder="ex: Dell, OVH, SSII locale..."
            />
          </div>
          <div className="col-md-3">
            <label className="form-label fw-medium">Type</label>
            <select name="kind" className="form-select" defaultValue={supplier?.kind ?? "editor"}>
              {Object.entries(SUPPLIER_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium">Site web</label>
            <input
              type="url"
              name="website"
              className="form-control"
              placeholder="https://..."
              defaultValue={v(supplier?.website)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium">Interlocuteur habituel</label>
            <input
              type="text"
              name="contact_name"
              className="form-control"
              defaultValue={v(supplier?.contactName)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium">Email (standard)</label>
            <input
              type="email"
              name="email"
              className="form-control"
              defaultValue={v(supplier?.email)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium">Téléphone (standard)</label>
            <input
              type="text"
              name="phone"
              className="form-control"
              defaultValue={v(supplier?.phone)}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-medium">Adresse</label>
            <input
              type="text"
              name="address"
              className="form-control"
              defaultValue={v(supplier?.address)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label fw-medium">Code postal</label>
            <input
              type="text"
              name="postal_code"
              className="form-control"
              defaultValue={v(supplier?.postalCode)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium">Ville</label>
            <input
              type="text"
              name="city"
              className="form-control"
              defaultValue={v(supplier?.city)}
            />
          </div>
        </div>
      </Section>

      <Section titre="Assistance" icone="bi-life-preserver" couleur="sky">
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-medium">Portail de tickets (URL)</label>
            <input
              type="url"
              name="support_url"
              className="form-control"
              placeholder="https://support.exemple.fr"
              defaultValue={v(supplier?.supportUrl)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label fw-medium">Hotline</label>
            <input
              type="text"
              name="support_phone"
              className="form-control"
              defaultValue={v(supplier?.supportPhone)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label fw-medium">Email de l'assistance</label>
            <input
              type="email"
              name="support_email"
              className="form-control"
              defaultValue={v(supplier?.supportEmail)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium">N° client / identifiant support</label>
            <input
              type="text"
              name="customer_ref"
              className="form-control"
              defaultValue={v(supplier?.customerRef)}
            />
            <div className="form-text">Celui que l'éditeur redemande à chaque appel.</div>
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium">Horaires</label>
            <input
              type="text"
              name="hours"
              className="form-control"
              placeholder="ex: lundi au vendredi 8h-17h"
              defaultValue={v(supplier?.hours)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label fw-medium">
              Horaires (2<sup>e</sup> ligne)
            </label>
            <input
              type="text"
              name="hours2"
              className="form-control"
              placeholder="ex: samedi 8h-12h"
              defaultValue={v(supplier?.hours2)}
            />
            <div className="form-text">
              Deux lignes : les horaires décrivent presque toujours deux régimes.
            </div>
          </div>
        </div>
      </Section>

      <BlocContact
        titre="Commercial"
        prefix="commercial"
        aide="Pour l'offre et le renouvellement. Distinct du standard ci-dessus, qui reste celui de la société."
        nom={supplier?.commercialContact}
        tel={supplier?.commercialPhone}
        mail={supplier?.commercialEmail}
        icone="bi-person-badge"
        couleur="emerald"
      />
      <BlocContact
        titre="Commercial (second)"
        prefix="commercial2"
        aide="Fréquent chez les éditeurs qui séparent le renouvellement de l'avant-vente, ou pendant une passation."
        nom={supplier?.commercialContact2}
        tel={supplier?.commercialPhone2}
        mail={supplier?.commercialEmail2}
        icone="bi-person-badge"
        couleur="teal"
      />
      <BlocContact
        titre="Administratif / facturation"
        prefix="admin"
        nom={supplier?.adminContact}
        tel={supplier?.adminPhone}
        mail={supplier?.adminEmail}
        icone="bi-receipt"
        couleur="amber"
      />
      <BlocContact
        titre="DPO de l'éditeur"
        prefix="dpo"
        aide="À qui écrire pour une violation ou une demande d'exercice de droits sur les données qu'il héberge. Distinct du DPO de la collectivité."
        nom={supplier?.dpoContact}
        tel={supplier?.dpoPhone}
        mail={supplier?.dpoEmail}
        icone="bi-shield-lock"
        couleur="rose"
      />

      <Section titre="Notes" icone="bi-journal-text" couleur="slate">
        <textarea
          name="notes"
          className="form-control"
          rows={3}
          placeholder="Procédure d'ouverture de ticket, escalade, infos contrat..."
          defaultValue={v(supplier?.notes)}
        />
      </Section>
      <PiedForm
        retour={retour}
        libelle={supplier ? "Enregistrer" : "Ajouter"}
        supprimer={
          supplier && user.canDelete("suppliers") ? `/suppliers/${supplier.id}/delete` : null
        }
        confirmation="Supprimer ce fournisseur ?"
      />
    </form>
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

/** suppliers/form.html : la grille, ou l'ancien formulaire (SUPPLIER_FORM_LEGACY). */
export function FormulaireFournisseur({
  supplier,
  user,
  csrf,
  retour,
  dansFiche = false,
}: FormProps & { dansFiche?: boolean }) {
  const legacy = user.settings.SUPPLIER_FORM_LEGACY;
  if (!legacy) return <FormCorps supplier={supplier} user={user} csrf={csrf} retour={retour} />;
  if (dansFiche)
    return (
      <div className="data-card p-4">
        <FormCorpsAncien supplier={supplier} user={user} csrf={csrf} retour={retour} />
      </div>
    );
  return (
    <div className="form-page">
      <nav className="form-sommaire" aria-label="Rubriques du formulaire" />
      <div className="form-corps">
        <div className="data-card p-4">
          <FormCorpsAncien supplier={supplier} user={user} csrf={csrf} retour={retour} />
        </div>
      </div>
    </div>
  );
}
