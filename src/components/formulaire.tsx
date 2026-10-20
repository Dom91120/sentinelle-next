/** Le gabarit de formulaire (port de _formulaire.html et _form_section.html). */
import { Icone } from "@/components/icones";

/** `entete_form(titre, retour, sous_titre, libelle)` */
export function EnteteForm({
  titre,
  retour,
  sousTitre,
  libelle = "Enregistrer",
}: {
  titre: React.ReactNode;
  retour: string;
  sousTitre?: React.ReactNode;
  libelle?: string;
}) {
  return (
    <div className="page-header form-entete">
      <div>
        <h1 className="page-title">{titre}</h1>
        {sousTitre ? <p className="page-subtitle">{sousTitre}</p> : null}
      </div>
      <div className="page-actions">
        <a href={retour} className="btn btn-outline-secondary js-retour">
          Annuler
        </a>
        <button type="submit" form="form-principal" className="btn btn-primary">
          <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> {libelle}
        </button>
      </div>
    </div>
  );
}

/** `pied_form(retour, libelle, supprimer, confirmation)` */
export function PiedForm({
  retour,
  libelle = "Enregistrer",
  supprimer,
  confirmation = "Supprimer cette fiche ?",
}: {
  retour: string;
  libelle?: string;
  supprimer?: string | null;
  confirmation?: string;
}) {
  return (
    <div className="form-pied">
      {supprimer ? (
        <button
          type="button"
          className="btn btn-ghost btn-ghost-danger form-pied-supprimer"
          data-confirm={confirmation}
          data-confirm-form="#form-supprimer"
          data-confirm-action={supprimer}
        >
          <Icone bi="bi-trash" taille="1em" classes="me-1" /> Supprimer
        </button>
      ) : null}
      <span className="form-pied-note text-muted small">
        <span className="text-danger">*</span> champ obligatoire
      </span>
      <a href={retour} className="btn btn-outline-secondary js-retour">
        Annuler
      </a>
      <button type="submit" className="btn btn-primary">
        <Icone bi="bi-check-lg" taille="1em" classes="me-1" /> {libelle}
      </button>
    </div>
  );
}

/** `section(titre, icone, couleur, kinds, aide)` : fieldset de formulaire coloré. */
export function Section({
  titre,
  icone,
  couleur = "indigo",
  kinds,
  aide,
  children,
}: {
  titre: string;
  icone: string;
  couleur?: string;
  kinds?: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      className={`form-section form-section--${couleur}${kinds ? " kind-section" : ""}`}
      data-kinds={kinds}
    >
      <legend className="form-section-titre">
        <Icone bi={icone} taille="1em" />
        {titre}
      </legend>
      {aide ? <p className="form-section-aide">{aide}</p> : null}
      <div className="form-section-corps">{children}</div>
    </fieldset>
  );
}

/** `rubrique_form(...)` : la même section, au format des formulaires en carte. */
export function RubriqueForm({
  titre,
  icone,
  couleur = "indigo",
  kinds,
  aide,
  children,
}: {
  titre: string;
  icone: string;
  couleur?: string;
  kinds?: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`saisie-rubrique${kinds ? " kind-section" : ""}`} data-kinds={kinds}>
      <div className="card-header-custom d-flex justify-content-between align-items-center">
        <h6 className={`fw-bold fiche-titre fiche-titre--${couleur} mb-0`}>
          <Icone bi={icone} taille={14} classes={`ico ico-${couleur}`} />
          {titre}
        </h6>
      </div>
      <div className="p-3">
        {aide ? <p className="form-section-aide">{aide}</p> : null}
        {children}
      </div>
    </div>
  );
}

/** Un <select> avec options {valeur: libellé}. */
export function Select({
  name,
  id,
  options,
  value,
  blank,
  classes = "form-select",
  required,
  defaultValue,
}: {
  name: string;
  id?: string;
  options: [string, string][];
  value?: string | null;
  blank?: string;
  classes?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <select
      name={name}
      id={id}
      className={classes}
      required={required}
      defaultValue={value ?? defaultValue ?? ""}
    >
      {blank !== undefined ? <option value="">{blank}</option> : null}
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
