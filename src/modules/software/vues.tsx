/** Les gabarits des logiciels (port de software/_form_corps.html, _synthese.html, _contacts.html, _flux.html, _partages.html). */

import { PiedForm } from "@/components/formulaire";
import { Icone, Lucide } from "@/components/icones";
import { nomChamp, QaButton, QaModal } from "@/components/quick-add";
import { ScriptDiffere } from "@/components/scripts";
import { Lu, LuBloc, Rangee, Rubrique } from "@/components/synthese";
import type {
  Contract,
  Equipment,
  Referential,
  Software,
  SoftwareLink,
  SoftwareShare,
  Supplier,
  UserService,
} from "@/generated/prisma/client";
import {
  AUTH_MODE_LABELS,
  DATA_LOCATION_LABELS,
  HOSTING_LABELS,
  LIFECYCLE_LABELS,
  SOURCE_TYPE_LABELS,
} from "@/lib/constantes";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { couleurIcone } from "@/lib/navigation";
import { softwareOverLicence } from "@/lib/statuts";
import {
  authModeLabel,
  criticalityLabel,
  formContextRapide,
  gdprLocationLabel,
  hostingLabel,
  lifecycleLabel,
  sourceTypeLabel,
} from "@/modules/software/server";
import type { CurrentUser } from "@/server/guards";

export const FLUX_ICONE: Record<string, string> = {
  sortant: "arrow-right",
  entrant: "arrow-left",
  double: "arrow-right-left",
};
export const FLUX_TITRE: Record<string, string> = {
  sortant: "Flux sortant vers",
  entrant: "Flux entrant depuis",
  double: "Flux à double sens avec",
};

export type Flux = { lien: SoftwareLink; sens: "sortant" | "entrant" | "double"; autre: Software };

type FormCommun = {
  item: Software | null;
  suppliers: Supplier[];
  contracts: Contract[];
  equipments: Equipment[];
  technologies: Referential[];
  userServices: UserService[];
  user: CurrentUser;
  csrf: string;
  retour: string;
  gdpr: boolean;
};

export type FormProps = FormCommun & {
  nonce?: string;
  itemContractIds?: number[];
  itemEquipmentIds?: number[];
  itemServiceIds?: number[];
};

function Sel({
  name,
  labels,
  current,
  blank,
  id,
  petit = true,
  disabled,
  classes = "",
  rapide,
}: {
  name: string;
  labels: Record<string, string>;
  current: string | null | undefined;
  blank?: string;
  id?: string;
  petit?: boolean;
  disabled?: boolean;
  classes?: string;
  /** Dans la modale d'ajout rapide : relevé par quick-add.js, hors formulaire. */
  rapide?: boolean;
}) {
  return (
    <select
      {...nomChamp(name, rapide)}
      id={id}
      className={`${petit ? "form-select form-select-sm" : "form-select"}${classes ? ` ${classes}` : ""}`}
      defaultValue={current ?? ""}
      disabled={disabled}
    >
      {blank ? <option value="">{blank}</option> : null}
      {Object.entries(labels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

/** Une rubrique de la carte : son en-tête (barre d'accent, titre) et son corps. */
function Carte({
  titre,
  bi,
  couleur,
  onglet,
  children,
}: {
  titre: string;
  bi: string;
  couleur: string;
  onglet?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="card-header-custom">
        <h6 className={`fw-bold fiche-titre fiche-titre--${couleur} mb-0`}>
          {onglet ? (
            <Icone bi={bi} taille="1em" classes={`ico-onglet ico-onglet--${onglet}`} />
          ) : bi.startsWith("bi-") ? (
            <Icone bi={bi} taille={14} classes={`ico ico-${couleur}`} />
          ) : (
            <Lucide nom={bi} taille={14} classes={`ico ico-${couleur}`} />
          )}
          {titre}
        </h6>
      </div>
      <div className="p-3">{children}</div>
    </>
  );
}

function Nature({
  item,
  rapide,
  prefixe = "",
}: {
  item: Software | null;
  rapide?: boolean;
  prefixe?: string;
}) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      <input
        type="checkbox"
        className="btn-check"
        {...nomChamp("is_docker", rapide)}
        id={`${prefixe}isDocker`}
        defaultChecked={Boolean(item?.isDocker)}
      />
      <label
        className="btn btn-outline-primary btn-sm"
        htmlFor={`${prefixe}isDocker`}
        title="Conteneurisé (Docker) — cumulable avec tout hébergement"
      >
        <i className="icon-docker me-1" />
        Docker
      </label>
      <input
        type="checkbox"
        className="btn-check"
        {...nomChamp("internal_dev", rapide)}
        id={`${prefixe}internalDev`}
        defaultChecked={Boolean(item?.internalDev)}
      />
      <label
        className="btn btn-outline-primary btn-sm"
        htmlFor={`${prefixe}internalDev`}
        title="Fait et maintenu par la DSI : ni éditeur, ni support, ni contrat"
      >
        <Icone bi="bi-code-slash" taille="1em" classes="me-1" />
        Dév. interne
      </label>
      <input
        type="checkbox"
        className="btn-check"
        {...nomChamp("no_server", rapide)}
        id={`${prefixe}noServer`}
        defaultChecked={Boolean(item?.noServer)}
      />
      <label
        className="btn btn-outline-primary btn-sm"
        htmlFor={`${prefixe}noServer`}
        title="Ne s’installe sur aucune machine du parc : SaaS, ou postes des agents"
      >
        <Icone bi="bi-slash-circle" taille="1em" classes="me-1" />
        Aucun serveur
      </label>
    </div>
  );
}

/**
 * Les champs d'un logiciel : le corps du formulaire d'une fiche (création, modification) et
 * celui de la modale « Nouvelle application » de l'ajout rapide, à l'identique.
 */
export function CorpsChamps({
  item,
  suppliers,
  technologies,
  gdpr,
  plusFournisseur,
  rapide = false,
  prefixe = "",
}: {
  item: Software | null;
  suppliers: Supplier[];
  technologies: Referential[];
  gdpr: boolean;
  /** Le bouton + à côté de l'éditeur (modale fournisseur à monter par l'appelant). */
  plusFournisseur: boolean;
  /** Modale d'ajout rapide : champs relevés par quick-add.js, hors formulaire. */
  rapide?: boolean;
  /** Préfixe des identifiants, pour ne pas heurter ceux de la page. */
  prefixe?: string;
}) {
  const v = (s: string | null | undefined) => s ?? "";
  return (
    <div className="data-card mb-3">
      <Carte titre="Logiciel" bi="bi-window-stack" couleur="indigo">
        <div className="grille grille-identite">
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swNom`}>
              Nom du logiciel <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              {...nomChamp("name", rapide)}
              id={`${prefixe}swNom`}
              className="form-control form-control-sm"
              {...(rapide ? { "data-qa-required": true } : { required: true })}
              defaultValue={item?.name ?? ""}
              placeholder="ex : GLPI, Office 365…"
            />
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swVersion`}>
              Version
            </label>
            <input
              type="text"
              {...nomChamp("version", rapide)}
              id={`${prefixe}swVersion`}
              className="form-control form-control-sm"
              defaultValue={v(item?.version)}
            />
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swSupplier`}>
              Éditeur
            </label>
            <div className="d-flex align-items-center gap-1">
              <select
                {...nomChamp("supplier_id", rapide)}
                id={`${prefixe}swSupplier`}
                className="form-select form-select-sm min-w-0 flex-grow-1"
                defaultValue={item?.supplierId ?? ""}
              >
                <option value="">— aucun —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {plusFournisseur ? (
                <QaButton
                  modalId="qaModalSupplier"
                  targetId={`${prefixe}swSupplier`}
                  title="Ajouter un éditeur"
                />
              ) : null}
            </div>
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swUrl`}>
              URL application
            </label>
            <input
              type="url"
              {...nomChamp("url", rapide)}
              id={`${prefixe}swUrl`}
              className="form-control form-control-sm"
              defaultValue={v(item?.url)}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="grille grille-usage">
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swStatut`}>
              Statut
            </label>
            <Sel
              rapide={rapide}
              name="lifecycle"
              labels={LIFECYCLE_LABELS}
              current={item ? item.lifecycle : "production"}
              id={`${prefixe}swStatut`}
            />
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swCriticite`}>
              Criticité
            </label>
            <select
              {...nomChamp("criticality", rapide)}
              id={`${prefixe}swCriticite`}
              className="form-select form-select-sm"
              defaultValue={item?.criticality ?? ""}
            >
              {[
                ["", "—"],
                ["1", "Faible"],
                ["2", "Moyenne"],
                ["3", "Élevée"],
                ["4", "Critique"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swUtilisateurs`}>
              Utilisateurs
            </label>
            <input
              type="number"
              min={0}
              {...nomChamp("users_count", rapide)}
              id={`${prefixe}swUtilisateurs`}
              className="form-control form-control-sm"
              defaultValue={item?.usersCount ?? ""}
            />
          </div>
          <div>
            <label
              className="form-label small mb-1"
              htmlFor={`${prefixe}swMax`}
              title="Plafond contractuel : au-delà, dépassement de licence"
            >
              Max
            </label>
            <input
              type="number"
              min={0}
              {...nomChamp("users_max", rapide)}
              id={`${prefixe}swMax`}
              className="form-control form-control-sm"
              defaultValue={item?.usersMax ?? ""}
            />
          </div>
          <div className="d-flex align-items-end gap-3">
            <div className="flex-grow-1 min-w-0">
              <label className="form-label small mb-1" htmlFor={`${prefixe}swAuth`}>
                Authentification
              </label>
              <Sel
                rapide={rapide}
                name="auth_mode"
                labels={AUTH_MODE_LABELS}
                current={item?.authMode ?? null}
                blank="— inconnue —"
                id={`${prefixe}swAuth`}
              />
            </div>
            <div className="text-center">
              <label
                className="form-label small mb-1 d-block"
                htmlFor={`${prefixe}authStrong`}
                title="Double authentification"
              >
                2FA
              </label>
              <input
                type="checkbox"
                className="form-check-input case-2fa"
                {...nomChamp("auth_strong", rapide)}
                id={`${prefixe}authStrong`}
                defaultChecked={Boolean(item?.authStrong)}
              />
            </div>
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swMiseEnService`}>
              Mise en service
            </label>
            <input
              type="date"
              {...nomChamp("service_date", rapide)}
              id={`${prefixe}swMiseEnService`}
              className="form-control form-control-sm champ-date"
              defaultValue={item?.serviceDate ? isoDate(item.serviceDate) : ""}
            />
          </div>
        </div>
        <div className="grille grille-technique">
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swHebergement`}>
              Hébergement
            </label>
            <Sel
              rapide={rapide}
              name="hosting"
              labels={HOSTING_LABELS}
              current={item ? item.hosting : "on_premise"}
              id={`${prefixe}swHebergement`}
              classes="champ-ajuste"
            />
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swTechno`}>
              Technologie
            </label>
            <select
              {...nomChamp("technology_id", rapide)}
              id={`${prefixe}swTechno`}
              className="form-select form-select-sm champ-ajuste"
              defaultValue={item?.technologyId ?? ""}
            >
              <option value="">— non renseignée —</option>
              {technologies.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swSource`}>
              Type licence
            </label>
            <Sel
              rapide={rapide}
              name="source_type"
              labels={SOURCE_TYPE_LABELS}
              current={item ? item.sourceType : "proprietaire"}
              id={`${prefixe}swSource`}
              classes="champ-ajuste"
            />
          </div>
          <div className="grille-contenu">
            <span className="form-label small mb-1 d-block">Nature</span>
            <Nature item={item} rapide={rapide} prefixe={prefixe} />
          </div>
        </div>
        <div className="grille grille-contacts">
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swRefMetier`}>
              Référent métier
            </label>
            <input
              type="text"
              {...nomChamp("responsible", rapide)}
              id={`${prefixe}swRefMetier`}
              className="form-control form-control-sm"
              defaultValue={v(item?.responsible)}
              data-ad-search=""
              data-ad-email="responsible_email"
              placeholder="Rechercher dans l'annuaire…"
            />
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swMailMetier`}>
              Courriel réf. métier
            </label>
            <input
              type="email"
              {...nomChamp("responsible_email", rapide)}
              id={`${prefixe}swMailMetier`}
              className="form-control form-control-sm"
              defaultValue={v(item?.responsibleEmail)}
            />
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swRefTech`}>
              Référent technique
            </label>
            <input
              type="text"
              {...nomChamp("tech_responsible", rapide)}
              id={`${prefixe}swRefTech`}
              className="form-control form-control-sm"
              defaultValue={v(item?.techResponsible)}
              data-ad-search=""
              data-ad-email="tech_responsible_email"
              placeholder="Rechercher dans l'annuaire…"
            />
          </div>

          <div>
            <label className="form-label small mb-1" htmlFor={`${prefixe}swMailTech`}>
              Courriel réf. technique
            </label>
            <input
              type="email"
              {...nomChamp("tech_responsible_email", rapide)}
              id={`${prefixe}swMailTech`}
              className="form-control form-control-sm"
              defaultValue={v(item?.techResponsibleEmail)}
            />
          </div>
        </div>
      </Carte>

      {gdpr ? (
        <Carte titre="RGPD" bi="bi-shield-lock" couleur="rose" onglet="rgpd">
          <div className="grille grille-rgpd">
            <div>
              <span className="form-label small mb-1 d-block">RGPD</span>
              <div className="form-check case-rgpd">
                <input
                  type="checkbox"
                  className="form-check-input"
                  {...nomChamp("gdpr_personal_data", rapide)}
                  id={`${prefixe}gdprPd`}
                  defaultChecked={Boolean(item?.gdprPersonalData)}
                />
                <label className="form-check-label small" htmlFor={`${prefixe}gdprPd`}>
                  Traite des données personnelles
                </label>
              </div>
            </div>
            <div>
              <label className="form-label small mb-1" htmlFor={`${prefixe}swRgpdCategories`}>
                Catégories de données
              </label>
              <input
                type="text"
                {...nomChamp("gdpr_categories", rapide)}
                id={`${prefixe}swRgpdCategories`}
                className="form-control form-control-sm"
                defaultValue={v(item?.gdprCategories)}
                placeholder="état civil, coordonnées, santé, NIR…"
              />
            </div>
            <div>
              <label className="form-label small mb-1" htmlFor={`${prefixe}swRgpdRegistre`}>
                Réf. registre
              </label>
              <input
                type="text"
                {...nomChamp("gdpr_registry_ref", rapide)}
                id={`${prefixe}swRgpdRegistre`}
                className="form-control form-control-sm"
                defaultValue={v(item?.gdprRegistryRef)}
                placeholder="n° du traitement"
              />
            </div>
            <div>
              <label className="form-label small mb-1" htmlFor={`${prefixe}swRgpdLieu`}>
                Localisation des données
              </label>
              <Sel
                rapide={rapide}
                name="gdpr_location"
                labels={DATA_LOCATION_LABELS}
                current={item ? item.gdprLocation : "inconnue"}
                id={`${prefixe}swRgpdLieu`}
              />
            </div>
          </div>
        </Carte>
      ) : null}

      <Carte titre="Descriptif" bi="bi-journal-text" couleur="slate">
        <label className="form-label small mb-1" htmlFor={`${prefixe}swDescriptif`}>
          Périmètre fonctionnel, dépendances, particularités
        </label>
        <textarea
          {...nomChamp("description", rapide)}
          id={`${prefixe}swDescriptif`}
          className="form-control form-control-sm"
          rows={3}
          placeholder="Périmètre fonctionnel, dépendances, particularités…"
          defaultValue={v(item?.description)}
        />
      </Carte>
    </div>
  );
}

/** software/_form_corps.html : la grille de SoftInventory. */
export function FormCorps({ item, suppliers, technologies, user, csrf, retour, gdpr }: FormProps) {
  return (
    <div className="form-seul">
      <form
        method="POST"
        id="form-principal"
        className="formulaire logiciel-saisie"
        data-edition-visible
        action={item ? `/inventory/logiciels/${item.id}/edit` : "/inventory/logiciels/create"}
      >
        <input type="hidden" name="csrf_token" value={csrf} />
        <CorpsChamps
          item={item}
          suppliers={suppliers}
          technologies={technologies}
          gdpr={gdpr}
          plusFournisseur={user.canEdit("suppliers")}
        />
        <PiedForm
          retour={retour}
          libelle={item ? "Enregistrer" : "Ajouter"}
          supprimer={
            item && user.canDelete("software") ? `/inventory/logiciels/${item.id}/delete` : null
          }
          confirmation="Supprimer ce logiciel ?"
        />
      </form>
    </div>
  );
}

/**
 * La modale « Nouvelle application » de l'ajout rapide (bouton + d'une fiche compte) : le
 * formulaire complet d'un logiciel, dans une fenêtre, sans quitter la fiche. Les champs sont
 * relevés par quick-add.js et envoyés à /inventory/logiciels/quick-create.
 */
export async function QaModalSoftware({ csrf, gdpr }: { csrf: string; gdpr: boolean }) {
  const ctx = await formContextRapide();
  return (
    <QaModal
      id="qaModalSoftware"
      endpoint="/inventory/logiciels/quick-create"
      titre="Nouvelle application"
      icone="bi-window-stack"
      csrf={csrf}
      taille="xl"
      classes="qa-modal-fiche"
      libelle="Ajouter"
    >
      <div className="logiciel-saisie">
        <CorpsChamps
          item={null}
          suppliers={ctx.suppliers}
          technologies={ctx.technologies}
          gdpr={gdpr}
          plusFournisseur={false}
          rapide
          prefixe="qaSw-"
        />
      </div>
    </QaModal>
  );
}

export type LogicielComplet = Software & {
  supplier: Supplier | null;
  technology: Referential | null;
};

/** software/_synthese.html */
export function Synthese({ item, gdpr }: { item: LogicielComplet; gdpr: boolean }) {
  const sup = item.supplier;
  const over = softwareOverLicence(item);
  const lifecycleBadge =
    (
      { production: "success", fin_de_vie: "warning", evaluation: "info" } as Record<string, string>
    )[item.lifecycle] ?? "muted";
  return (
    <div
      className="data-card mb-3 synthese synthese--cases"
      style={{ "--lu-intitule": "70px" } as React.CSSProperties}
    >
      <Rubrique titre="Logiciel" bi="bi-window-stack" couleur="indigo">
        <Rangee>
          <Lu label="Version" valeur={item.version} />
          <LuBloc label="Éditeur">
            {item.internalDev ? (
              "Développement interne"
            ) : sup ? (
              <a href={`/suppliers/${item.supplierId}`}>{sup.name}</a>
            ) : null}
          </LuBloc>
          <LuBloc label="URL" titre="URL de l'application">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener" className="text-truncate d-block">
                {item.url}
              </a>
            ) : null}
          </LuBloc>
        </Rangee>
        <Rangee>
          <LuBloc label="Statut">
            <span className={`badge-status badge-${lifecycleBadge}`}>{lifecycleLabel(item)}</span>
          </LuBloc>
          <Lu label="Criticité" valeur={criticalityLabel(item)} />
          <LuBloc
            label="Utilisateurs"
            titre="Plafond contractuel : au-delà, dépassement de licence"
          >
            {item.usersCount !== null ? (
              <>
                {item.usersCount}
                {item.usersMax ? ` / ${item.usersMax}` : ""}
                {over ? (
                  <span className="badge bg-warning-subtle text-warning-emphasis ms-1">
                    dépassement
                  </span>
                ) : null}
              </>
            ) : item.usersMax ? (
              `max ${item.usersMax}`
            ) : null}
          </LuBloc>
          <Lu label="Réf. métier" valeur={item.responsible} titre="Référent métier" />
          <LuBloc label="Mail métier" titre="Courriel du référent métier">
            {item.responsibleEmail ? (
              <a href={`mailto:${item.responsibleEmail}`} className="text-truncate d-block">
                {item.responsibleEmail}
              </a>
            ) : null}
          </LuBloc>
        </Rangee>
        <Rangee>
          <Lu label="Héberg." valeur={hostingLabel(item)} titre="Hébergement" />
          <Lu label="Technologie" valeur={item.technology ? item.technology.label : null} />
          <Lu label="Type licence" valeur={sourceTypeLabel(item)} />
        </Rangee>
        <Rangee>
          <LuBloc label="Authentif." titre="Authentification">
            {authModeLabel(item) ? (
              authModeLabel(item)
            ) : (
              <span className="badge-status badge-warning">Non renseignée</span>
            )}
            {item.authStrong ? (
              <span className="badge bg-success-subtle text-success ms-1">2FA</span>
            ) : null}
          </LuBloc>
          <Lu
            label="Mise en serv."
            valeur={item.serviceDate ? dateCourte(item.serviceDate) : null}
            titre="Mise en service"
            facultatif
          />
          <Lu label="Réf. tech." valeur={item.techResponsible} titre="Référent technique" />
        </Rangee>
        <Rangee>
          {/* Les natures en texte, comme les autres valeurs (pas d'étiquette à icône). */}
          <Lu
            label="Nature"
            facultatif
            valeur={
              [
                item.isDocker ? "Docker" : null,
                item.internalDev ? "Dév. interne" : null,
                item.noServer ? "Aucun serveur" : null,
              ]
                .filter(Boolean)
                .join(" · ") || null
            }
          />
          <LuBloc label="Mail tech." titre="Courriel du référent technique">
            {item.techResponsibleEmail ? (
              <a href={`mailto:${item.techResponsibleEmail}`} className="text-truncate d-block">
                {item.techResponsibleEmail}
              </a>
            ) : null}
          </LuBloc>
        </Rangee>
      </Rubrique>

      {gdpr ? (
        <Rubrique titre="RGPD" bi="bi-shield-lock" couleur="rose" onglet="rgpd">
          <Rangee>
            <Lu
              label="RGPD"
              valeur={item.gdprPersonalData ? "Traitées" : "Aucune donnée personnelle"}
              pleine={!item.gdprPersonalData}
              titre="Données personnelles"
            />
            {item.gdprPersonalData ? (
              <>
                <Lu label="Catégorie" valeur={item.gdprCategories} />
                <Lu label="Réf. registre" valeur={item.gdprRegistryRef} />
                <Lu label="Localisation" valeur={gdprLocationLabel(item)} />
              </>
            ) : null}
          </Rangee>
          {item.gdprPersonalData && sup && (sup.dpoContact || sup.dpoEmail) ? (
            <Rangee>
              <Lu label="DPO éditeur" valeur={sup.dpoContact} titre="DPO de l'éditeur" />
              <LuBloc label="Courriel DPO">
                {sup.dpoEmail ? (
                  <a href={`mailto:${sup.dpoEmail}`} className="text-truncate d-block">
                    {sup.dpoEmail}
                  </a>
                ) : null}
              </LuBloc>
            </Rangee>
          ) : null}
        </Rubrique>
      ) : null}

      <Rubrique titre="Descriptif" bi="bi-journal-text" couleur="slate">
        <Rangee>
          <Lu label="Descriptif" valeur={item.description} pleine texte sansLabel />
        </Rangee>
      </Rubrique>
    </div>
  );
}

// ── Contacts (_contacts.html) ──

function Tel({ numero }: { numero: string }) {
  const chiffres = numero.replace(/[ .]/g, "");
  const paires =
    chiffres.length === 10 && /^\d+$/.test(chiffres) ? chiffres.match(/.{2}/g)?.join(" ") : numero;
  return <a href={`tel:${chiffres}`}>{paires}</a>;
}

function Ligne({
  label,
  icone,
  large = false,
  children,
}: {
  label: string;
  icone: string;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`contact-ligne${large ? " contact-ligne--large" : ""}`}>
      <span className="contact-ico">
        <Lucide nom={icone} taille={16} />
      </span>
      <div className="min-w-0">
        <dt>{label}</dt>
        <dd className="text-truncate">{children}</dd>
      </div>
    </div>
  );
}

const Vide = () => <span className="contact-vide">Non renseigné</span>;

export function supplierHasContacts(s: Supplier): boolean {
  return [
    s.commercialContact,
    s.commercialPhone,
    s.commercialEmail,
    s.commercialContact2,
    s.commercialPhone2,
    s.commercialEmail2,
    s.adminContact,
    s.adminPhone,
    s.adminEmail,
    s.dpoContact,
    s.dpoPhone,
    s.dpoEmail,
  ].some(Boolean);
}

type LigneContact = {
  label: string;
  icone: string;
  large?: boolean;
  /** null : rien de renseigné. */
  valeur: React.ReactNode | null;
};

/**
 * Le bloc des contacts d'un fournisseur (software/_contacts.html) : l'assistance, puis les
 * contacts. `titre` : sur la fiche du fournisseur lui-même, « Contacts » suffit (le nom est
 * déjà en titre de page). `seulementRenseigne` : n'affiche que les lignes qui ont une valeur,
 * au lieu de « Non renseigné » partout.
 */
export function Contacts({
  sup,
  titre,
  seulementRenseigne = false,
}: {
  sup: Supplier | null;
  titre?: string;
  seulementRenseigne?: boolean;
}) {
  if (!sup)
    return (
      <div className="contact-aucun">
        Aucun éditeur n'est rattaché à ce logiciel. Renseignez-le dans l'onglet « Détails » pour
        retrouver ici ses contacts.
      </div>
    );
  // Sur la fiche du fournisseur (seulementRenseigne), l'interlocuteur, le standard et le
  // courriel ont leurs propres lignes ; sur un logiciel, ils servent de repli au support.
  const telSupport = sup.supportPhone || (seulementRenseigne ? null : sup.phone);
  const mailSupport = sup.supportEmail || (seulementRenseigne ? null : sup.email);
  const horaires = [sup.hours, sup.hours2].filter(Boolean).join(" · ");
  const second = sup.commercialContact2 || sup.commercialPhone2 || sup.commercialEmail2;
  const tel = (n: string | null) => (n ? <Tel numero={n} /> : null);
  const mail = (a: string | null) => (a ? <a href={`mailto:${a}`}>{a}</a> : null);
  const assistance: LigneContact[] = [
    ...(seulementRenseigne
      ? [
          { label: "Interlocuteur", icone: "user", valeur: sup.contactName || null },
          { label: "Standard", icone: "phone", valeur: tel(sup.phone) },
          { label: "Courriel", icone: "mail", valeur: mail(sup.email) },
        ]
      : []),
    {
      label: "Portail de support",
      icone: "life-buoy",
      valeur: sup.supportUrl ? (
        <a href={sup.supportUrl} target="_blank" rel="noopener">
          {sup.supportUrl}
        </a>
      ) : null,
    },
    { label: "Tél du support", icone: "phone", valeur: tel(telSupport) },
    { label: "Mail du support", icone: "mail", valeur: mail(mailSupport) },
    { label: "N° de client", icone: "badge-check", valeur: sup.customerRef || null },
    { label: "Horaires du support", icone: "clock", large: true, valeur: horaires || null },
  ];
  const contacts: LigneContact[] = [
    { label: "Contact commercial", icone: "user", valeur: sup.commercialContact || null },
    { label: "Tél commercial", icone: "phone", valeur: tel(sup.commercialPhone) },
    { label: "Mail commercial", icone: "mail", valeur: mail(sup.commercialEmail) },
    ...(second
      ? [
          { label: "Contact commercial 2", icone: "user", valeur: sup.commercialContact2 || null },
          { label: "Tél commercial 2", icone: "phone", valeur: tel(sup.commercialPhone2) },
          { label: "Mail commercial 2", icone: "mail", valeur: mail(sup.commercialEmail2) },
        ]
      : []),
    { label: "Contact administratif", icone: "user", valeur: sup.adminContact || null },
    { label: "Tél administratif", icone: "phone", valeur: tel(sup.adminPhone) },
    { label: "Mail administratif", icone: "mail", valeur: mail(sup.adminEmail) },
    { label: "DPO", icone: "user", valeur: sup.dpoContact || null },
    { label: "Tél DPO", icone: "phone", valeur: tel(sup.dpoPhone) },
    { label: "Mail DPO", icone: "mail", valeur: mail(sup.dpoEmail) },
  ];
  const garder = (l: LigneContact[]) =>
    seulementRenseigne ? l.filter((x) => x.valeur !== null) : l;
  const haut = garder(assistance);
  const bas = garder(contacts);
  const rien = !(
    sup.supportUrl ||
    telSupport ||
    mailSupport ||
    sup.customerRef ||
    horaires ||
    (seulementRenseigne && (sup.contactName || sup.phone || sup.email)) ||
    supplierHasContacts(sup)
  );
  const ligne = (l: LigneContact) => (
    <Ligne key={l.label} label={l.label} icone={l.icone} large={l.large}>
      {l.valeur ?? <Vide />}
    </Ligne>
  );
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom">
        <h6 className="fw-bold fiche-titre fiche-titre--rose mb-0">
          <Lucide nom="contact-round" taille={14} classes="ico-onglet ico-onglet--contacts" />
          {titre ?? `Contacts — ${sup.name}`}
        </h6>
      </div>
      <div className="p-3">
        {rien ? (
          <div className="contact-aucun">
            Aucun contact n'est renseigné sur la fiche de « {sup.name} ».
          </div>
        ) : (
          <dl className="contacts-grille mb-0">
            {haut.map(ligne)}
            {haut.length && bas.length ? (
              <div className="contacts-filet" aria-hidden="true" />
            ) : null}
            {bas.map(ligne)}
          </dl>
        )}
      </div>
    </div>
  );
}

// ── Interconnexions (_flux.html) ──

const FLUX_JS = `// Le sens choisi dans la liste passe au champ caché et au bouton.
document.addEventListener('click', function (e) {
    var item = e.target.closest('.flux-sens-choix [data-sens]');
    if (!item) return;
    var boite = item.closest('.flux-sens-choix');
    var bouton = boite.querySelector('[data-bs-toggle="dropdown"]');
    var libelle = 'Sens du flux : ' + item.dataset.libelle;
    boite.querySelector('input[name="sens"]').value = item.dataset.sens;
    boite.querySelector('.js-sens-icone').innerHTML = item.querySelector('svg').outerHTML;
    bouton.title = libelle;
    bouton.setAttribute('aria-label', libelle);
    boite.querySelectorAll('[data-sens]').forEach(function (i) {
        i.classList.toggle('active', i === item);
    });
    bouton.focus();
});`;

const CHOIX_SENS: [string, string, string][] = [
  ["vers", "sortant", "Vers"],
  ["depuis", "entrant", "Depuis"],
  ["double", "double", "Double sens"],
];

/** La valeur du choix de sens (`vers` / `depuis` / `double`) d'un flux lu depuis une fiche. */
const SENS_VALEUR: Record<Flux["sens"], string> = {
  sortant: "vers",
  entrant: "depuis",
  double: "double",
};

/**
 * Le bouton-liste du sens d'un flux : un champ caché `sens` et une icône qui suit le choix
 * (FLUX_JS). Sert à déclarer un flux comme à le corriger.
 */
function ChoixSens({ valeur }: { valeur: string }) {
  const courant = CHOIX_SENS.find(([v]) => v === valeur) ?? CHOIX_SENS[0];
  return (
    <div className="dropdown flux-sens-choix">
      <input type="hidden" name="sens" value={courant[0]} />
      <button
        type="button"
        className="btn btn-sm btn-outline-primary dropdown-toggle"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        title={`Sens du flux : ${courant[2]}`}
        aria-label={`Sens du flux : ${courant[2]}`}
      >
        <span className="js-sens-icone">
          <Lucide nom={FLUX_ICONE[courant[1]]} taille={14} />
        </span>
      </button>
      <ul className="dropdown-menu">
        {CHOIX_SENS.map(([v, sens, libelle]) => (
          <li key={v}>
            <button
              type="button"
              className={`dropdown-item d-flex align-items-center gap-2${v === courant[0] ? " active" : ""}`}
              data-sens={v}
              data-libelle={libelle}
            >
              <Lucide nom={FLUX_ICONE[sens]} taille={14} />
              {libelle}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FluxCarte({
  item,
  flux,
  autres,
  user,
  csrf,
  nonce,
}: {
  item: Software;
  flux: Flux[];
  autres: Software[];
  user: CurrentUser;
  csrf: string;
  nonce?: string;
}) {
  const peutEditer = user.canEdit("software");
  const peutSupprimer = user.canDelete("software");
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom">
        <h6 className="fw-bold fiche-titre fiche-titre--violet mb-0">
          <Lucide nom="arrow-right-left" taille={14} classes="ico ico-violet" />
          Interconnexions <span className="badge bg-secondary ms-1">{flux.length}</span>
        </h6>
      </div>
      <div className="p-3">
        {flux.length ? (
          <ul className="list-unstyled mb-3 flux-liste">
            {flux.map(({ lien, sens, autre }) => (
              <li key={lien.id}>
                <div className="d-flex align-items-center justify-content-between gap-3">
                  <span className="d-flex align-items-center gap-2 min-w-0">
                    <Lucide nom={FLUX_ICONE[sens]} taille={16} classes="flux-sens flex-shrink-0" />
                    <a
                      href={`/inventory/logiciels/${autre.id}`}
                      className="fw-medium text-decoration-none"
                      title={`${FLUX_TITRE[sens]} ${autre.name}`}
                    >
                      {autre.name}
                    </a>
                    {lien.description ? (
                      <span className="flux-desc text-truncate">— {lien.description}</span>
                    ) : null}
                  </span>
                  {peutEditer || peutSupprimer ? (
                    <span className="d-flex align-items-center gap-1 flex-shrink-0">
                      {peutEditer ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-icone"
                          data-bs-toggle="collapse"
                          data-bs-target={`#fluxEdit${lien.id}`}
                          title="Modifier le flux (sens, description)"
                          aria-label="Modifier le flux (sens, description)"
                        >
                          <Lucide nom="pencil" taille={16} />
                        </button>
                      ) : null}
                      {peutSupprimer ? (
                        <form method="POST" action={`/inventory/logiciels/links/${lien.id}/delete`}>
                          <input type="hidden" name="csrf_token" value={csrf} />
                          <input type="hidden" name="from_id" value={item.id} />
                          <button
                            type="submit"
                            className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                            title="Supprimer l'interconnexion"
                            aria-label="Supprimer l'interconnexion"
                            data-confirm={`Supprimer ce flux avec « ${autre.name} » ?`}
                          >
                            <Lucide nom="trash-2" taille={16} />
                          </button>
                        </form>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                {peutEditer ? (
                  <div className="collapse" id={`fluxEdit${lien.id}`}>
                    <form
                      method="POST"
                      action={`/inventory/logiciels/links/${lien.id}/edit`}
                      className="d-flex flex-wrap align-items-center gap-2 p-2 mt-1 rounded border bg-body-tertiary"
                    >
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <input type="hidden" name="from_id" value={item.id} />
                      <ChoixSens valeur={SENS_VALEUR[sens]} />
                      <span className="small text-muted">{autre.name}</span>
                      <input
                        type="text"
                        name="description"
                        className="form-control form-control-sm flex-grow-1"
                        style={{ maxWidth: "32rem" }}
                        defaultValue={lien.description ?? ""}
                        placeholder="Description du flux (ex : export paie mensuel)"
                      />
                      <button type="submit" className="btn btn-sm btn-primary">
                        Enregistrer
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mb-3">Aucun flux déclaré.</p>
        )}
        {peutEditer && autres.length ? (
          <>
            <form
              method="POST"
              action={`/inventory/logiciels/${item.id}/links/add`}
              className="d-flex flex-wrap align-items-center gap-2"
            >
              <input type="hidden" name="csrf_token" value={csrf} />
              <ChoixSens valeur="vers" />
              <select
                name="other_id"
                className="form-select form-select-sm w-auto"
                aria-label="Logiciel"
                required
                defaultValue=""
              >
                <option value="">Logiciel…</option>
                {autres.map((sw) => (
                  <option key={sw.id} value={sw.id}>
                    {sw.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="description"
                className="form-control form-control-sm"
                style={{ maxWidth: "20rem" }}
                placeholder="Description du flux (ex : export paie mensuel)"
              />
              <button type="submit" className="btn btn-sm btn-outline-secondary">
                <Lucide nom="plus" taille={14} classes="me-1" />
                Ajouter
              </button>
            </form>
            <ScriptDiffere code={FLUX_JS} nonce={nonce} />
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Dossiers (_partages.html) ──

const PARTAGES_JS = `(function () {
    document.querySelectorAll('.js-copier').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var ligne = btn.closest('li');
            var code = ligne && ligne.querySelector('.js-chemin');
            if (!code || !navigator.clipboard) return;
            var origine = btn.innerHTML;
            navigator.clipboard.writeText(code.textContent.trim()).then(function () {
                btn.innerHTML = origine.replace('#copy', '#check').replace('lucide-copy', 'lucide-check');
                setTimeout(function () { btn.innerHTML = origine; }, 1500);
            });
        });
    });
})();`;

export function Partages({
  item,
  partages,
  user,
  csrf,
  nonce,
}: {
  item: Software;
  partages: SoftwareShare[];
  user: CurrentUser;
  csrf: string;
  nonce?: string;
}) {
  const peutEditer = user.canEdit("software");
  const peutSupprimer = user.canDelete("software");
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom d-flex justify-content-between align-items-center">
        <h6 className="fw-bold fiche-titre fiche-titre--slate mb-0">
          <Icone
            bi="bi-folder2-open"
            taille={14}
            classes={`ico ico-${couleurIcone("bi-folder2-open")}`}
          />
          Dossiers <span className="badge bg-secondary ms-1">{partages.length}</span>
        </h6>
        {peutEditer ? (
          <button
            className="btn btn-sm btn-ghost btn-icone"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#nouveauPartage"
            title="Ajouter un dossier"
            aria-label="Ajouter un dossier"
          >
            <Lucide nom="plus" taille={16} />
          </button>
        ) : null}
      </div>

      {peutEditer ? (
        <div className="collapse" id="nouveauPartage">
          <form
            method="POST"
            action={`/inventory/logiciels/${item.id}/shares/add`}
            className="p-3 border-bottom bg-body-tertiary"
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Libellé</label>
                <input
                  type="text"
                  name="label"
                  className="form-control form-control-sm"
                  placeholder="Installeurs, Documentation…"
                />
              </div>
              <div className="col">
                <label className="form-label fw-medium small mb-1">Chemin *</label>
                <input
                  type="text"
                  name="path"
                  className="form-control form-control-sm"
                  required
                  placeholder="Z:\Applications\..."
                />
              </div>
              <div className="col-auto d-flex gap-1">
                <button
                  type="submit"
                  className="btn btn-sm btn-ghost btn-icone btn-valider"
                  title="Enregistrer"
                  aria-label="Enregistrer"
                >
                  <Lucide nom="check" taille={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost btn-icone btn-annuler"
                  title="Annuler"
                  aria-label="Annuler"
                  data-bs-toggle="collapse"
                  data-bs-target="#nouveauPartage"
                >
                  <Lucide nom="x" taille={16} />
                </button>
              </div>
            </div>
            <div className="form-text mt-2">
              Les installeurs, les outils, les notes de version — tout ce qui est trop lourd ou trop
              vivant pour une pièce jointe, qui ne reçoit que des actes figés.
            </div>
          </form>
        </div>
      ) : null}

      <div className="px-3 pb-3">
        {partages.length ? (
          <ul className="list-unstyled mb-0 dossiers-liste">
            {partages.map((p, i) => (
              <li key={p.id} className={`py-2${i === 0 ? "" : " border-top"}`}>
                <div className="d-flex align-items-start gap-2">
                  <Lucide nom="folder-open" taille={16} classes="doc-ico flex-shrink-0" />
                  <div className="min-w-0 flex-grow-1">
                    <div className="d-flex align-items-center gap-2 min-w-0">
                      <code className="dossier-chemin js-chemin">{p.path}</code>
                      <button
                        type="button"
                        className="doc-dl js-copier flex-shrink-0"
                        title={`Copier ${p.path}`}
                        aria-label={`Copier le chemin ${p.path}`}
                      >
                        <Lucide nom="copy" taille={14} />
                      </button>
                    </div>
                    <div className="doc-sous">
                      {p.label ? `${p.label} · ` : ""}À coller dans la barre d'adresse de
                      l'Explorateur.
                    </div>
                  </div>
                  {peutEditer ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-icone flex-shrink-0"
                      data-bs-toggle="collapse"
                      data-bs-target={`#partageEdit${p.id}`}
                      title="Modifier le dossier"
                      aria-label="Modifier le dossier"
                    >
                      <Lucide nom="pencil" taille={16} />
                    </button>
                  ) : null}
                  {peutSupprimer ? (
                    <form
                      method="POST"
                      action={`/inventory/logiciels/shares/${p.id}/delete`}
                      className="flex-shrink-0"
                    >
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <button
                        type="submit"
                        className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                        title="Retirer le dossier"
                        aria-label="Retirer le dossier"
                        data-confirm="Retirer ce dossier ?"
                      >
                        <Lucide nom="trash-2" taille={16} />
                      </button>
                    </form>
                  ) : null}
                </div>
                {peutEditer ? (
                  <div className="collapse doc-edit-volet" id={`partageEdit${p.id}`}>
                    <form
                      method="POST"
                      action={`/inventory/logiciels/shares/${p.id}/edit`}
                      className="doc-edit p-2 rounded border bg-body-tertiary"
                    >
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <div className="row g-2 align-items-end">
                        <div className="col-md-3">
                          <label
                            className="form-label fw-medium small mb-1"
                            htmlFor={`partageLabel${p.id}`}
                          >
                            Libellé
                          </label>
                          <input
                            type="text"
                            name="label"
                            id={`partageLabel${p.id}`}
                            className="form-control form-control-sm"
                            defaultValue={p.label ?? ""}
                            maxLength={128}
                            placeholder="Installeurs, Documentation…"
                          />
                        </div>
                        <div className="col">
                          <label
                            className="form-label fw-medium small mb-1"
                            htmlFor={`partageChemin${p.id}`}
                          >
                            Chemin *
                          </label>
                          <input
                            type="text"
                            name="path"
                            id={`partageChemin${p.id}`}
                            className="form-control form-control-sm"
                            defaultValue={p.path}
                            maxLength={512}
                            required
                          />
                        </div>
                        <div className="col-auto d-flex gap-1">
                          <button
                            type="submit"
                            className="btn btn-sm btn-ghost btn-icone btn-valider"
                            title="Enregistrer"
                            aria-label="Enregistrer"
                          >
                            <Lucide nom="check" taille={16} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost btn-icone btn-annuler"
                            title="Annuler"
                            aria-label="Annuler"
                            data-bs-toggle="collapse"
                            data-bs-target={`#partageEdit${p.id}`}
                          >
                            <Lucide nom="x" taille={16} />
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mb-0 pt-2">Aucun dossier rattaché.</p>
        )}
      </div>
      <ScriptDiffere code={PARTAGES_JS} nonce={nonce} />
    </div>
  );
}
