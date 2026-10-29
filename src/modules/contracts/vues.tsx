/** Les gabarits des contrats (port de contracts/_form_corps.html, _synthese.html, _tableau.html). */

import { PiedForm } from "@/components/formulaire";
import { Icone, Lucide } from "@/components/icones";
import { StatusBadge } from "@/components/macros";
import { QaButton } from "@/components/quick-add";
import { euros, Lu, LuBloc, Pastille, Rangee, Rubrique } from "@/components/synthese";
import type {
  Contract,
  Equipment,
  Referential,
  Software,
  Supplier,
} from "@/generated/prisma/client";
import { EQUIPMENT_KIND_ICONS, EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { isoDate } from "@/lib/forms-util";
import { dateCourte, delai } from "@/lib/libelles";
import type { Seuils } from "@/lib/statuts";
import {
  contractActionDeadline,
  contractDaysLeft,
  contractEnCours,
  contractKindLabel,
  contractStatus,
} from "@/lib/statuts";
import { natureLabel } from "@/modules/contracts/server";
import type { CurrentUser } from "@/server/guards";

export type ContratComplet = Contract & {
  kindRef: Referential | null;
  supplier: Supplier | null;
  software: { software: Software }[];
  equipments: { equipment: Equipment }[];
};

export type FormProps = {
  contract: Contract | null;
  logicielsChoisis: number[];
  kindOptions: Referential[];
  natureLabels: Record<string, string>;
  suppliers: Supplier[];
  equipments: Equipment[];
  softwareList: (Software & { supplier: Supplier | null })[];
  couverts: { software: number[]; equipment: number[] };
  user: CurrentUser;
  csrf: string;
  retour: string;
  actionForm?: string;
  inline?: boolean;
  /** Création depuis une fiche fournisseur : ce fournisseur est présélectionné. */
  fournisseurChoisi?: number | null;
};

function Rub({
  titre,
  bi,
  couleur,
  droite,
  children,
}: {
  titre: string;
  bi: string;
  couleur: string;
  droite?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="card-header-custom d-flex justify-content-between align-items-center">
        <h6 className={`fw-bold fiche-titre fiche-titre--${couleur} mb-0`}>
          {bi.startsWith("bi-") ? (
            <Icone bi={bi} taille={14} classes={`ico ico-${couleur}`} />
          ) : (
            <Lucide nom={bi} taille={14} classes={`ico ico-${couleur}`} />
          )}
          {titre}
        </h6>
        {droite ? <div className="d-flex gap-1 marches-actions">{droite}</div> : null}
      </div>
      <div className="p-3">{children}</div>
    </>
  );
}

function ModaleChoix({
  id,
  titre,
  nomIcone,
  groupe,
  aide,
}: {
  id: string;
  titre: string;
  nomIcone: string;
  groupe: string;
  aide: string;
}) {
  return (
    <div
      className="modal fade"
      id={id}
      tabIndex={-1}
      aria-hidden="true"
      aria-labelledby={`${id}-titre`}
      data-choix-select="contractCovered"
      data-choix-groupe={groupe}
    >
      <div className="modal-dialog modal-choix">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title d-flex align-items-center gap-2" id={`${id}-titre`}>
              <Lucide nom={nomIcone} taille={18} classes="text-muted" />
              {titre}
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Fermer"
            />
          </div>
          <div className="modal-body">
            <div className="choix-liste" data-choix-liste />
            <div className="form-text">{aide}</div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              data-bs-dismiss="modal"
            >
              Annuler
            </button>
            <button type="button" className="btn btn-sm btn-primary" data-choix-valider>
              Valider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function num(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

/** contracts/_form_corps.html : la grille de SoftInventory. */
export function FormCorps({
  contract,
  logicielsChoisis,
  kindOptions,
  natureLabels,
  suppliers,
  equipments,
  softwareList,
  couverts,
  user,
  csrf,
  retour,
  actionForm,
  inline = false,
  fournisseurChoisi = null,
}: FormProps) {
  const kindDefaut = contract
    ? (contract.kindId ?? "")
    : (kindOptions.find((t) => t.label === "Maintenance")?.id ?? "");
  const notice = contract ? (contract.noticeDays ?? 0) : 0;
  const choisis = [
    ...couverts.software.map((i) => `software:${i}`),
    ...couverts.equipment.map((i) => `equipment:${i}`),
    ...(contract ? [] : logicielsChoisis.map((i) => `software:${i}`)),
  ];
  return (
    <>
      <div className="form-seul">
        <form
          method="POST"
          id="form-principal"
          className="formulaire marche-saisie"
          data-edition-visible
          action={actionForm}
        >
          <input type="hidden" name="csrf_token" value={csrf} />

          <div className="data-card mb-3">
            <Rub titre="Contrat" bi="bi-file-earmark-text" couleur="amber">
              <div className="rangee">
                <div>
                  <label className="form-label small mb-1" htmlFor="ctNature">
                    Nature
                  </label>
                  <select
                    name="nature"
                    id="ctNature"
                    className="form-select form-select-sm l-100"
                    defaultValue={contract?.nature ?? ""}
                  >
                    <option value="">—</option>
                    {Object.entries(natureLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label small mb-1" htmlFor="ctReference">
                    Référence
                  </label>
                  <input
                    type="text"
                    name="reference"
                    id="ctReference"
                    className="form-control form-control-sm l-100"
                    defaultValue={contract?.reference ?? ""}
                  />
                </div>
                <div>
                  <label className="form-label small mb-1" htmlFor="ctType">
                    Type
                  </label>
                  <select
                    name="kind_id"
                    id="ctType"
                    className="form-select form-select-sm l-140"
                    defaultValue={kindDefaut}
                  >
                    <option value="">—</option>
                    {kindOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grandit">
                  <label className="form-label small mb-1" htmlFor="ctNom">
                    Libellé *
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="ctNom"
                    className="form-control form-control-sm"
                    required
                    defaultValue={contract?.name ?? ""}
                    placeholder="Ex : maintenance Finances, licences Office 365"
                  />
                </div>
                <div>
                  <label
                    className="form-label small mb-1"
                    htmlFor="ctRefFournisseur"
                    title="Référence fournisseur"
                  >
                    Réf. fournisseur
                  </label>
                  <input
                    type="text"
                    name="supplier_reference"
                    id="ctRefFournisseur"
                    className="form-control form-control-sm l-150"
                    defaultValue={contract?.supplierReference ?? ""}
                    placeholder="n° de commande chez lui"
                  />
                </div>
              </div>

              <div className="rangee">
                <div className="grandit fournisseur">
                  <label className="form-label small mb-1" htmlFor="supplierSelect">
                    Fournisseur
                  </label>
                  <div className="d-flex align-items-center gap-1">
                    <select
                      name="supplier_id"
                      id="supplierSelect"
                      className="form-select form-select-sm min-w-0 flex-grow-1"
                      defaultValue={contract?.supplierId ?? fournisseurChoisi ?? ""}
                    >
                      <option value="">— non précisé —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {user.canEdit("suppliers") ? (
                      <QaButton
                        modalId="qaModalSupplier"
                        targetId="supplierSelect"
                        title="Ajouter un fournisseur"
                      />
                    ) : null}
                  </div>
                </div>
                <div>
                  <label
                    className="form-label small mb-1"
                    htmlFor="ctMontant"
                    title="Montant annuel"
                  >
                    Mt annuel
                  </label>
                  <input
                    type="text"
                    name="cost_yearly"
                    id="ctMontant"
                    className="form-control form-control-sm l-montant"
                    inputMode="decimal"
                    data-montant=""
                    defaultValue={num(contract?.costYearly)}
                  />
                </div>
                <div>
                  <label className="form-label small mb-1" htmlFor="ctMaxi" title="Maximum annuel">
                    Max annuel
                  </label>
                  <input
                    type="text"
                    name="cost_max_yearly"
                    id="ctMaxi"
                    className="form-control form-control-sm l-montant"
                    inputMode="decimal"
                    data-montant=""
                    defaultValue={num(contract?.costMaxYearly)}
                  />
                </div>
                <div>
                  <label
                    className="form-label small mb-1"
                    htmlFor="ctTotal"
                    title="Montant total sur la durée du marché"
                  >
                    Mt total
                  </label>
                  <input
                    type="text"
                    name="cost_total"
                    id="ctTotal"
                    className="form-control form-control-sm l-montant"
                    inputMode="decimal"
                    data-montant=""
                    defaultValue={num(contract?.costTotal)}
                  />
                </div>
                <div>
                  <label
                    className="form-label small mb-1"
                    htmlFor="ctImputation"
                    title="Imputation budgétaire"
                  >
                    Imputation
                  </label>
                  <input
                    type="text"
                    name="budget_code"
                    id="ctImputation"
                    className="form-control form-control-sm l-140"
                    defaultValue={contract?.budgetCode ?? ""}
                    placeholder="6156, 65818…"
                  />
                </div>
              </div>

              <div className="rangee">
                <div>
                  <label
                    className="form-label small mb-1"
                    htmlFor="ctBon"
                    title="Bon de commande signé le"
                  >
                    Signé le
                  </label>
                  <input
                    type="date"
                    name="order_signed_on"
                    id="ctBon"
                    className="form-control form-control-sm l-date"
                    defaultValue={contract?.orderSignedOn ? isoDate(contract.orderSignedOn) : ""}
                  />
                </div>
                <div>
                  <label className="form-label small mb-1" htmlFor="ctDebut">
                    Début
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    id="ctDebut"
                    className="form-control form-control-sm l-date"
                    defaultValue={contract?.startDate ? isoDate(contract.startDate) : ""}
                  />
                </div>
                <div>
                  <label className="form-label small mb-1" htmlFor="ctFin">
                    Échéance
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    id="ctFin"
                    className="form-control form-control-sm l-date"
                    defaultValue={contract?.endDate ? isoDate(contract.endDate) : ""}
                  />
                </div>
                <div>
                  <label className="form-label small mb-1" htmlFor="ctDuree">
                    Durée
                  </label>
                  <select
                    name="firm_years"
                    id="ctDuree"
                    className="form-select form-select-sm l-duree"
                    defaultValue={num(contract?.firmYears)}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n} an{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label small mb-1" htmlFor="ctRenouv" title="Renouvelable">
                    Renouv.
                  </label>
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="number"
                      name="renewals"
                      id="ctRenouv"
                      className="form-control form-control-sm l-chiffre"
                      min={0}
                      max={3}
                      step={1}
                      defaultValue={num(contract?.renewals)}
                    />
                    <span className="small text-muted">fois</span>
                  </div>
                </div>
                <div>
                  <label className="form-label small mb-1" htmlFor="autoRenew" title="Reconduction">
                    Recond.
                  </label>
                  <div className="form-check form-switch reconduction">
                    <input
                      type="checkbox"
                      name="auto_renew"
                      className="form-check-input"
                      id="autoRenew"
                      defaultChecked={contract ? contract.autoRenew : true}
                    />
                    <label className="form-check-label small" htmlFor="autoRenew">
                      Tacite
                    </label>
                  </div>
                </div>
                <div>
                  <label
                    className="form-label small mb-1"
                    htmlFor="ctPeriode"
                    title="Durée de chaque reconduction"
                  >
                    Période
                  </label>
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="number"
                      name="renewal_years"
                      id="ctPeriode"
                      className="form-control form-control-sm l-chiffre"
                      min={1}
                      max={4}
                      step={1}
                      defaultValue={num(contract?.renewalYears)}
                      data-accord="an|ans"
                    />
                    <span className="small text-muted">
                      {contract && contract.renewalYears === 1 ? "an" : "ans"}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="form-label small mb-1" htmlFor="ctPreavis">
                    Préavis
                  </label>
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="number"
                      name="notice_days"
                      id="ctPreavis"
                      className="form-control form-control-sm l-jours"
                      min={0}
                      max={365}
                      step={1}
                      defaultValue={notice}
                      data-accord="jour|jours"
                    />
                    <span className="small text-muted">{notice < 2 ? "jour" : "jours"}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label small mb-1" htmlFor="ctNotes">
                  Notes
                </label>
                <textarea
                  name="description"
                  id="ctNotes"
                  className="form-control form-control-sm"
                  rows={2}
                  placeholder="Périmètre couvert, conditions, procédure de renouvellement…"
                  defaultValue={contract?.description ?? ""}
                />
              </div>
            </Rub>

            <Rub
              titre="Éléments couverts"
              bi="boxes"
              couleur="indigo"
              droite={
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost btn-icone"
                    data-bs-toggle="modal"
                    data-bs-target="#choixLogiciel"
                    title="Ajouter un logiciel du catalogue"
                    aria-label="Ajouter un logiciel du catalogue"
                  >
                    <Lucide nom="app-window" taille={16} classes="kind-icon--software" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost btn-icone"
                    data-bs-toggle="modal"
                    data-bs-target="#choixMateriel"
                    title="Ajouter un matériel de l'inventaire"
                    aria-label="Ajouter un matériel de l'inventaire"
                  >
                    <Lucide nom="server" taille={16} classes="kind-icon--physical" />
                  </button>
                </>
              }
            >
              <select
                name="covered_ids"
                id="contractCovered"
                className="form-select form-select-sm"
                multiple
                size={6}
                aria-label="Éléments couverts"
                data-sans-recherche=""
                defaultValue={choisis}
              >
                <optgroup label="Logiciel" data-icone="app-window">
                  {softwareList.map((sw) => (
                    <option
                      key={sw.id}
                      value={`software:${sw.id}`}
                      data-kind="software"
                      data-url={`/inventory/logiciels/${sw.id}`}
                    >
                      {sw.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Matériel" data-icone="server">
                  {equipments.map((e) => (
                    <option
                      key={e.id}
                      value={`equipment:${e.id}`}
                      data-icone={EQUIPMENT_KIND_ICONS[e.kind ?? "vm"] ?? "server"}
                      data-kind={e.kind || "vm"}
                      data-url={`/inventory/${e.id}`}
                      title={EQUIPMENT_KIND_LABELS[e.kind] ?? e.kind}
                    >
                      {e.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </Rub>
          </div>

          {inline ? (
            <div className="d-flex align-items-center justify-content-end gap-2">
              <span className="me-auto" aria-hidden="true" />
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                data-formulaire-fermer=""
              >
                Annuler
              </button>
              <button type="submit" className="btn btn-sm btn-primary">
                <Icone bi="bi-check-lg" taille="1em" classes="me-1" />{" "}
                {contract ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          ) : (
            <PiedForm
              retour={retour}
              libelle={contract ? "Enregistrer" : "Ajouter"}
              supprimer={
                contract && user.canDelete("contracts") ? `/contracts/${contract.id}/delete` : null
              }
              confirmation="Supprimer ce contrat ?"
            />
          )}
        </form>
      </div>

      <ModaleChoix
        id="choixLogiciel"
        titre="Logiciels du catalogue"
        nomIcone="app-window"
        groupe="Logiciel"
        aide="Les logiciels que cet acte couvre. Un marché en couvre autant qu'il en couvre réellement."
      />
      <ModaleChoix
        id="choixMateriel"
        titre="Matériel de l'inventaire"
        nomIcone="server"
        groupe="Matériel"
        aide="Les serveurs, NAS et équipements réseau que cet acte couvre."
      />
    </>
  );
}

function ans(n: number | null): string | null {
  return n ? `${n} an${n > 1 ? "s" : ""}` : null;
}

/** contracts/_synthese.html */
export function Synthese({ contract }: { contract: ContratComplet }) {
  const logiciels = [...contract.software.map((l) => l.software)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const equipements = [...contract.equipments.map((l) => l.equipment)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return (
    <div
      className="data-card mb-3 synthese synthese--cases"
      style={{ "--lu-intitule": "80px" } as React.CSSProperties}
    >
      <Rubrique
        titre={natureLabel(contract) || "Contrat"}
        bi="bi-file-earmark-text"
        couleur="amber"
      >
        <Rangee>
          <Lu label="Référence" valeur={contract.reference} />
          <Lu label="Type" valeur={contractKindLabel(contract)} />
          <Lu
            label="Réf. fourn."
            valeur={contract.supplierReference}
            titre="Référence fournisseur"
          />
          <LuBloc label="Fournisseur">
            {contract.supplier ? (
              <a href={`/suppliers/${contract.supplierId}`}>{contract.supplier.name}</a>
            ) : null}
          </LuBloc>
        </Rangee>
        <Rangee>
          <Lu label="Mt annuel" valeur={euros(contract.costYearly)} titre="Montant annuel" />
          <Lu label="Max annuel" valeur={euros(contract.costMaxYearly)} titre="Maximum annuel" />
          <Lu
            label="Mt total"
            valeur={euros(contract.costTotal)}
            titre="Montant total sur la durée du marché"
          />
          <Lu label="Imputation" valeur={contract.budgetCode} titre="Imputation budgétaire" />
        </Rangee>
        <Rangee>
          <Lu
            label="Signé le"
            valeur={contract.orderSignedOn ? dateCourte(contract.orderSignedOn) : null}
            titre="Bon de commande signé le"
          />
          <Lu label="Début" valeur={contract.startDate ? dateCourte(contract.startDate) : null} />
          <Lu label="Échéance" valeur={contract.endDate ? dateCourte(contract.endDate) : null} />
          <Lu label="Durée" valeur={ans(contract.firmYears)} />
          <Lu
            label="Renouvelable"
            valeur={contract.renewals !== null ? `${contract.renewals} fois` : null}
          />
          <Lu label="Reconduction" valeur={contract.autoRenew ? "Tacite" : "Non"} />
          <Lu
            label="Période"
            valeur={ans(contract.renewalYears)}
            titre="Durée de chaque reconduction"
          />
          <Lu
            label="Préavis"
            valeur={
              contract.noticeDays
                ? `${contract.noticeDays} jour${contract.noticeDays > 1 ? "s" : ""}`
                : null
            }
          />
        </Rangee>
        <Rangee>
          <Lu label="Notes" valeur={contract.description} large />
        </Rangee>
      </Rubrique>

      <Rubrique titre="Éléments couverts" bi="boxes" couleur="indigo">
        {logiciels.length || equipements.length ? (
          <div className="pastilles">
            {logiciels.map((sw) => (
              <Pastille
                key={`s${sw.id}`}
                url={`/inventory/logiciels/${sw.id}`}
                nomIcone="app-window"
                nom={sw.name}
                teinte="software"
                titre="Logiciel"
              />
            ))}
            {equipements.map((e) => (
              <Pastille
                key={`e${e.id}`}
                url={`/inventory/${e.id}`}
                nomIcone={EQUIPMENT_KIND_ICONS[e.kind ?? "vm"] ?? "server"}
                nom={e.name}
                teinte={e.kind || "vm"}
                titre={EQUIPMENT_KIND_LABELS[e.kind] ?? e.kind}
              />
            ))}
          </div>
        ) : (
          <span className="text-muted small">Aucun élément couvert.</span>
        )}
      </Rubrique>
    </div>
  );
}

function milliers(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** contracts/_tableau.html */
export function TableauContrats({
  contracts,
  today,
  total = true,
  filtrable = false,
  seuils,
  vide,
}: {
  contracts: ContratComplet[];
  today: Date;
  total?: boolean;
  filtrable?: boolean;
  seuils: Seuils;
  vide: React.ReactNode;
}) {
  let somme = 0;
  const lignes = contracts.map((c) => {
    const courant = contractEnCours(c, today);
    if (courant && c.costYearly) somme += c.costYearly;
    const statut = contractStatus(c, seuils, today);
    const deadline = contractActionDeadline(c);
    const jours = contractDaysLeft(c, today);
    const logiciels = c.software.map((l) => l.software);
    const equipements = c.equipments.map((l) => l.equipment);
    return (
      <tr
        key={c.id}
        className={`${filtrable ? `row-${statut}` : ""}${!courant ? " contrat-hors-periode" : ""}`}
      >
        <td className={`small text-nowrap cell-ref${c.reference ? " fw-medium" : ""}`}>
          {c.reference ? (
            <a href={`/contracts/${c.id}`} className="text-decoration-none">
              {c.reference}
            </a>
          ) : (
            "—"
          )}
        </td>
        <td className="cell-contrat">
          {/* Un nom trop long se coupe par « … » et se lit en entier au survol (texte-tronque.js). */}
          <a
            href={`/contracts/${c.id}`}
            className="d-block fw-medium text-decoration-none text-truncate"
          >
            {c.name}
          </a>
          <small className="d-block text-muted text-truncate">
            {[natureLabel(c), contractKindLabel(c)].filter(Boolean).join(" · ")}
            {!courant
              ? ` · ${c.endDate && c.endDate.getTime() < today.getTime() ? "échu" : "à venir"}`
              : ""}
          </small>
        </td>
        <td className="small cell-fournisseur">
          {c.supplier ? (
            <a href={`/suppliers/${c.supplierId}`} className="fw-medium text-decoration-none">
              {c.supplier.name}
            </a>
          ) : (
            <span className="text-muted">—</span>
          )}
        </td>
        <td className="small cell-couvre">
          {logiciels.map((sw) => (
            <a
              key={`s${sw.id}`}
              href={`/inventory/logiciels/${sw.id}`}
              className="d-block fw-medium text-decoration-none text-truncate"
            >
              <Lucide nom="app-window" taille={13} classes="me-1 kind-icon--software" />
              {sw.name}
            </a>
          ))}
          {equipements.map((e) => (
            <a
              key={`e${e.id}`}
              href={`/inventory/${e.id}`}
              className="d-block fw-medium text-decoration-none text-truncate"
            >
              <Lucide
                nom={EQUIPMENT_KIND_ICONS[e.kind ?? "vm"] ?? "server"}
                taille={13}
                classes={`me-1 kind-icon--${e.kind || "vm"}`}
              />
              {e.name}
            </a>
          ))}
          {!logiciels.length && !equipements.length ? <span className="text-muted">—</span> : null}
        </td>
        <td className="small cell-periode text-muted">
          {c.startDate || c.endDate ? (
            <>
              <span className="d-block">{c.startDate ? dateCourte(c.startDate) : "…"}</span>
              <span className="d-block">{c.endDate ? dateCourte(c.endDate) : "…"}</span>
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="small text-nowrap">
          {deadline ? (
            <>
              {dateCourte(deadline)}
              {c.noticeDays ? (
                <small className="d-block text-muted">préavis {c.noticeDays} j</small>
              ) : null}
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="small text-end text-nowrap">
          {c.costYearly ? `${milliers(c.costYearly)} €` : "—"}
          {c.costMaxYearly ? (
            <small className="d-block text-muted">max {milliers(c.costMaxYearly)} €</small>
          ) : null}
        </td>
        <td className="text-nowrap text-center">
          <StatusBadge status={statut} />
          {jours === null ? (
            <span className="delai-contrat delai-contrat--warning">
              <Lucide nom="calendar-clock" taille={12} />
              Date à renseigner
            </span>
          ) : (
            <span className={`delai-contrat delai-contrat--${statut}`}>
              <Lucide nom="calendar-clock" taille={12} />
              {delai(jours, "dépassé de")}
            </span>
          )}
        </td>
      </tr>
    );
  });
  return (
    <table
      className={`table table-hover mb-0 contrats-fournisseur${filtrable ? " js-filterable" : ""}`}
    >
      {/* Colonnes fixes : le nom du contrat (colonne sans largeur, qui prend le reste) se
          tronque au lieu de pousser les autres. Période et Agir avant ont la largeur d'une
          date (77 px + 2 × 12 px de marge). */}
      <colgroup>
        <col style={{ width: "10%" }} />
        <col />
        <col style={{ width: "11%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "102px" }} />
        <col style={{ width: "102px" }} />
        <col style={{ width: "9%" }} />
        <col style={{ width: "9%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>Réf.</th>
          <th>Contrat</th>
          <th>Fournisseur</th>
          <th>Couvre</th>
          <th>Période</th>
          <th className="text-nowrap">Agir avant</th>
          <th className="text-end text-nowrap" title="Montant annuel">
            Mt annuel
          </th>
          <th className="text-center">Statut</th>
        </tr>
      </thead>
      <tbody>{lignes.length ? lignes : vide}</tbody>
      {total && somme ? (
        <tfoot>
          <tr>
            <td colSpan={6} className="small text-muted text-end">
              Total annuel des contrats en cours
            </td>
            <td className="small text-end text-nowrap fw-semibold">{milliers(somme)} €</td>
            <td />
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}
