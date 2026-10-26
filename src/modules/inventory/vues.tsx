/** Les gabarits de l'inventaire (port de inventory/_form_corps.html et _synthese.html). */

import { PiedForm, RubriqueForm } from "@/components/formulaire";
import { Icone } from "@/components/icones";
import { QaButton, QaModalSupplier } from "@/components/quick-add";
import { ScriptDiffere } from "@/components/scripts";
import { Lu, LuBloc, Rangee, Rubrique } from "@/components/synthese";
import type { Equipment, Software, SoftwareEquipment, Supplier } from "@/generated/prisma/client";
import {
  ENVIRONMENT_LABELS,
  EQUIPMENT_FAMILIES,
  EQUIPMENT_KIND_LABELS,
  equipmentPorte,
  EQUIPMENT_KIND_GROUPS_ATTR as groupes,
} from "@/lib/constantes";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { ENV_CHOICES, KIND_CHOICES } from "@/modules/inventory/server";
import type { CurrentUser } from "@/server/guards";

export type EquipementComplet = Equipment & {
  supplier: Supplier | null;
  softwareList: (SoftwareEquipment & { software: Software })[];
};

const KIND_JS = `(function () {
    var kindSel = document.getElementById('kind');
    function refresh() {
        var k = kindSel.value;
        document.querySelectorAll('.kind-section').forEach(function (el) {
            var kinds = (el.dataset.kinds || '').split(' ');
            el.style.display = kinds.indexOf(k) === -1 ? 'none' : '';
        });
    }
    kindSel.addEventListener('change', refresh);
    refresh();
})();`;

export type FormProps = {
  item: Equipment | null;
  famille: string;
  suppliers: Supplier[];
  critLabels: Record<number, string>;
  user: CurrentUser;
  csrf: string;
  nonce?: string;
  retour: string;
  actionForm?: string;
};

function Champ({
  label,
  name,
  value,
  type = "text",
  col = "col-md-4",
  kinds,
  step,
  min,
  placeholder,
  title,
  largeur,
}: {
  label: string;
  name: string;
  value: unknown;
  type?: string;
  col?: string;
  kinds?: string;
  step?: string;
  min?: number;
  placeholder?: string;
  title?: string;
  /** Classe de largeur de la saisie (l-go…), pour un champ étroit dans une colonne auto. */
  largeur?: string;
}) {
  const v = value === null || value === undefined ? "" : String(value);
  return (
    <div className={`${col}${kinds ? " kind-section" : ""}`} data-kinds={kinds}>
      <label className="form-label small" title={title}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        className={`form-control${type === "date" ? " l-date" : ""}${largeur ? ` ${largeur}` : ""}`}
        defaultValue={v}
        step={step}
        min={min}
        placeholder={placeholder}
      />
    </div>
  );
}

/** inventory/_form_corps.html */
export function FormCorps({
  item,
  famille,
  suppliers,
  critLabels,
  user,
  csrf,
  nonce,
  retour,
  actionForm,
}: FormProps) {
  const natures = EQUIPMENT_FAMILIES[famille] ?? EQUIPMENT_FAMILIES.serveurs;
  const defaut = natures[0];
  const val = (attr: keyof Equipment) =>
    item && item[attr] !== null && item[attr] !== undefined ? item[attr] : "";
  const date = (d: Date | null | undefined) => (d ? isoDate(d) : "");
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
            {/* Une seule rubrique, comme « Logiciel » sur une fiche logiciel : les rangées des
                anciennes rubriques s'enchaînent ; un bloc propre à certains types garde son
                conteneur .kind-section (masqué par KIND_JS selon le type choisi). */}
            <RubriqueForm titre="Matériel" icone="bi-hdd-stack" couleur="indigo">
              <div className="row g-3 mb-3">
                <div className="col-md-3">
                  <label className="form-label small fw-medium">Type *</label>
                  <select
                    name="kind"
                    id="kind"
                    className="form-select"
                    defaultValue={item ? item.kind : defaut}
                  >
                    {KIND_CHOICES.filter(([v]) => item || natures.includes(v)).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-5">
                  <label className="form-label small fw-medium">Nom *</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    required
                    defaultValue={String(val("name"))}
                    placeholder="ex: SRV-APP01"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-medium">Environnement</label>
                  <select
                    name="environment"
                    className="form-select"
                    defaultValue={item?.environment ?? ""}
                  >
                    {ENV_CHOICES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-medium">Criticité</label>
                  <select
                    name="criticality"
                    className="form-select"
                    defaultValue={item?.criticality ?? ""}
                  >
                    <option value="">—</option>
                    {Object.entries(critLabels).map(([lvl, lbl]) => (
                      <option key={lvl} value={lvl}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row g-3 mb-3">
                <Champ
                  label="OS"
                  name="os"
                  value={val("os")}
                  placeholder="Windows Server, Debian..."
                />
                <Champ label="Version" name="os_version" value={val("osVersion")} col="col-md-3" />
                <Champ
                  label="Dernière MAJ"
                  name="os_last_update"
                  value={date(item?.osLastUpdate)}
                  type="date"
                  col="col-md-auto"
                  title="Dernière mise à jour de l'OS"
                />
                <Champ
                  label="Supervision"
                  name="supervision"
                  value={val("supervision")}
                  col="col-md-2"
                  kinds={groupes.supervision}
                  placeholder="outil"
                />
              </div>
              <div className="kind-section" data-kinds={groupes.virtualisation}>
                <div className="row g-3 mb-3">
                  <Champ label="Serveur hôte" name="host_server" value={val("hostServer")} />
                  <Champ
                    label="Hyperviseur"
                    name="hypervisor"
                    value={val("hypervisor")}
                    col="col-md-2"
                    placeholder="VMware/HV"
                  />
                  <Champ
                    label="vCPU"
                    name="vcpu"
                    value={val("vcpu")}
                    type="number"
                    col="col-md-auto"
                    largeur="l-go"
                  />
                  <Champ
                    label="RAM (Go)"
                    name="ram_go"
                    value={val("ramGo")}
                    type="number"
                    step="any"
                    col="col-md-auto"
                    largeur="l-go"
                  />
                  <Champ
                    label="HDD 1 (Go)"
                    name="hdd1_go"
                    value={val("hdd1Go")}
                    type="number"
                    step="any"
                    col="col-md-auto"
                    largeur="l-go"
                  />
                  <Champ
                    label="HDD 2 (Go)"
                    name="hdd2_go"
                    value={val("hdd2Go")}
                    type="number"
                    step="any"
                    col="col-md-auto"
                    largeur="l-go"
                  />
                  <Champ
                    label="HDD 3 (Go)"
                    name="hdd3_go"
                    value={val("hdd3Go")}
                    type="number"
                    step="any"
                    col="col-md-auto"
                    largeur="l-go"
                  />
                </div>
              </div>
              {/* Réseau : adresse pour tout ce qui en a une, masque et VLAN selon le type. */}
              <div className="row g-3 mb-3">
                <Champ
                  label="Adresse IP"
                  name="ip_address"
                  value={val("ipAddress")}
                  kinds={groupes.reseau}
                />
                <Champ label="Masque" name="netmask" value={val("netmask")} kinds={groupes.vlan} />
                <Champ label="VLAN" name="vlan" value={val("vlan")} kinds={groupes.vlan} />
              </div>
              <div className="kind-section" data-kinds={groupes.materiel}>
                <div className="row g-3 mb-3">
                  <Champ
                    label="Constructeur / Modèle"
                    name="manufacturer_model"
                    value={val("manufacturerModel")}
                    kinds={groupes.materiel}
                  />
                  <Champ
                    label="N° de série"
                    name="serial_number"
                    value={val("serialNumber")}
                    kinds={groupes.materiel}
                  />
                  <Champ
                    label="Service Tag"
                    name="service_tag"
                    value={val("serviceTag")}
                    kinds={groupes.materiel}
                    placeholder="identifiant de support (Dell, HP…)"
                  />
                  <Champ
                    label="Date achat / mise en service"
                    name="purchase_date"
                    value={date(item?.purchaseDate)}
                    type="date"
                    col="col-md-auto"
                    kinds={groupes.materiel}
                  />
                  <Champ
                    label="Emplacement"
                    name="location"
                    value={val("location")}
                    placeholder="salle serveur, baie 3, étage 2"
                  />
                  <Champ
                    label="Interface d'administration"
                    name="management_url"
                    value={val("managementUrl")}
                    kinds={groupes.administration}
                    placeholder="https://… ou une IP"
                  />
                  <Champ
                    label="Nombre de ports"
                    name="ports"
                    value={val("ports")}
                    type="number"
                    min={0}
                    col="col-md-2"
                    kinds={groupes.ports}
                  />
                  <Champ
                    label="Fin de garantie"
                    name="warranty_end"
                    value={date(item?.warrantyEnd)}
                    type="date"
                    col="col-md-auto"
                  />
                  <Champ
                    label="Contrat de maintenance"
                    name="maintenance_contract"
                    value={val("maintenanceContract")}
                  />
                  <div className="col-md-4">
                    <label className="form-label small">Fournisseur / support</label>
                    <div className="input-group">
                      <select
                        name="supplier_id"
                        id="eqSupplier"
                        className="form-select"
                        defaultValue={item?.supplierId ?? ""}
                      >
                        <option value="">— Sélectionner —</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {user.canEdit("suppliers") ? (
                        <QaButton
                          modalId="qaModalSupplier"
                          targetId="eqSupplier"
                          title="Ajouter un fournisseur"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="kind-section" data-kinds={groupes.stockage}>
                <div className="row g-3 mb-3">
                  <Champ
                    label="Protocoles"
                    name="protocols"
                    value={val("protocols")}
                    placeholder="SMB/NFS/iSCSI"
                  />
                  <Champ
                    label="Capacité (To)"
                    name="capacity_to"
                    value={val("capacityTo")}
                    type="number"
                    step="any"
                    col="col-md-2"
                  />
                  <Champ
                    label="Utilisé (To)"
                    name="used_to"
                    value={val("usedTo")}
                    type="number"
                    step="any"
                    col="col-md-2"
                  />
                  <Champ label="RAID" name="raid" value={val("raid")} />
                  <Champ
                    label="Accès (utilisateurs / groupes)"
                    name="access"
                    value={val("access")}
                    col="col-12"
                  />
                </div>
              </div>
              <div className="row g-3 mb-3">
                {/* Rôle et services se partagent à parts égales la largeur que la colonne
                    Outils (largeur de son contenu) leur laisse. */}
                <Champ
                  label="Rôle principal"
                  name="role_principal"
                  value={val("rolePrincipal")}
                  col="col-md"
                />
                <Champ
                  label="Services utilisateurs"
                  name="user_services"
                  value={val("userServices")}
                  kinds={groupes.services}
                  col="col-md"
                />
                {/* Les outils d'une VM : trois interrupteurs sur la ligne du rôle principal, à la
                    hauteur des champs, sous un intitulé comme les autres colonnes. */}
                <div className="col-md-auto kind-section" data-kinds={groupes.virtualisation}>
                  <label className="form-label small">Outils</label>
                  <div className="d-flex gap-4 flex-wrap align-items-center form-outils">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="supervised"
                        id="supervised"
                        defaultChecked={Boolean(item?.supervised)}
                      />
                      <label className="form-check-label small" htmlFor="supervised">
                        Supervision
                      </label>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="cyberwatch"
                        id="cyberwatch"
                        defaultChecked={Boolean(item?.cyberwatch)}
                      />
                      <label className="form-check-label small" htmlFor="cyberwatch">
                        Cyberwatch
                      </label>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="ninja_one"
                        id="ninja_one"
                        defaultChecked={Boolean(item?.ninjaOne)}
                      />
                      <label className="form-check-label small" htmlFor="ninja_one">
                        Ninja One
                      </label>
                    </div>
                  </div>
                </div>
                <Champ
                  label="Usage principal / données stockées"
                  name="usage"
                  value={val("usage")}
                  col="col-12"
                  kinds={groupes.usage}
                />
              </div>
              <div className="row g-3">
                <Champ
                  label="PRA / PCA"
                  name="pra_pca"
                  value={val("praPca")}
                  col="col-md-6"
                  kinds={groupes.pra}
                />
                <Champ
                  label="Sauvegarde 1"
                  name="backup1"
                  value={val("backup1")}
                  col="col-md-3"
                  placeholder="outil"
                />
                <Champ
                  label="Fréquence 1"
                  name="backup1_freq"
                  value={val("backup1Freq")}
                  col="col-md-3"
                />
                <Champ
                  label="Sauvegarde 2"
                  name="backup2"
                  value={val("backup2")}
                  col="col-md-3"
                  kinds={groupes.virtualisation}
                />
                <Champ
                  label="Fréquence 2"
                  name="backup2_freq"
                  value={val("backup2Freq")}
                  col="col-md-3"
                  kinds={groupes.virtualisation}
                />
              </div>
            </RubriqueForm>

            <RubriqueForm titre="Notes" icone="bi-journal-text" couleur="slate">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label small">Observations</label>
                  <textarea
                    name="observations"
                    rows={3}
                    className="form-control"
                    defaultValue={String(val("observations"))}
                  />
                </div>
              </div>
            </RubriqueForm>
          </div>

          <PiedForm
            retour={retour}
            libelle={item ? "Enregistrer" : "Ajouter"}
            supprimer={item && user.canDelete("inventory") ? `/inventory/${item.id}/delete` : null}
            confirmation="Supprimer cet équipement ?"
          />
        </form>
      </div>

      {user.canEdit("suppliers") ? <QaModalSupplier csrf={csrf} /> : null}
      <ScriptDiffere code={KIND_JS} nonce={nonce} />
    </>
  );
}

export function kindLabel(e: { kind: string | null }): string {
  return EQUIPMENT_KIND_LABELS[e.kind ?? ""] ?? e.kind ?? "";
}

export function envLabel(e: { environment: string | null }): string {
  return ENVIRONMENT_LABELS[e.environment ?? ""] ?? e.environment ?? "";
}

function Coche({ libelle }: { libelle: string }) {
  return (
    <span className="badge-nature">
      <Icone bi="bi-check-circle-fill" taille="1em" classes="me-1 text-success" />
      {libelle}
    </span>
  );
}

/** inventory/_synthese.html */
export function Synthese({ item }: { item: EquipementComplet }) {
  const porte = (g: string) => equipmentPorte(item.kind, g);
  const osComplet = `${item.os ?? ""}${item.osVersion ? ` ${item.osVersion}` : ""}`.trim();
  const stockage = [item.hdd1Go, item.hdd2Go, item.hdd3Go].filter((x) => x).join(" / ");
  return (
    <div
      className="data-card mb-3 synthese synthese--cases"
      style={{ "--lu-intitule": "80px" } as React.CSSProperties}
    >
      {/* Une seule rubrique, comme « Logiciel » sur une fiche logiciel : les rangées
          s'enchaînent, et une seule ligne « À compléter » en bas. */}
      <Rubrique titre="Matériel" bi="bi-hdd-stack" couleur="indigo">
        <Rangee>
          <Lu label="Type" valeur={kindLabel(item)} />
          <Lu label="Env." valeur={envLabel(item)} titre="Environnement" />
          <Lu label="Rôle principal" valeur={item.rolePrincipal} />
        </Rangee>
        <Rangee>
          <Lu
            label="Logiciels"
            valeur={item.softwareList.map((l) => l.software.name).join(", ")}
            pleine
            titre="Logiciels métiers"
          />
          {porte("services") ? (
            <Lu label="Services" valeur={item.userServices} pleine titre="Services utilisateurs" />
          ) : null}
          {porte("usage") ? (
            <Lu label="Usage" valeur={item.usage} pleine titre="Usage / données stockées" />
          ) : null}
        </Rangee>
        <Rangee>
          <Lu label="OS" valeur={osComplet} />
          <Lu
            label="Dernière MAJ"
            valeur={item.osLastUpdate ? dateCourte(item.osLastUpdate) : null}
            titre="Dernière mise à jour de l'OS"
          />
          {porte("supervision") ? <Lu label="Supervision" valeur={item.supervision} /> : null}
        </Rangee>
        {porte("virtualisation") ? (
          <Rangee>
            <LuBloc label="Outils" facultatif>
              {item.supervised ? <Coche libelle="Supervision" /> : null}
              {item.cyberwatch ? <Coche libelle="Cyberwatch" /> : null}
              {item.ninjaOne ? <Coche libelle="Ninja One" /> : null}
            </LuBloc>
          </Rangee>
        ) : null}
        {porte("reseau") ? (
          <>
            <Rangee>
              <Lu label="Adresse IP" valeur={item.ipAddress} />
              {porte("vlan") ? (
                <>
                  <Lu label="Masque" valeur={item.netmask} />
                  <Lu label="VLAN" valeur={item.vlan} />
                </>
              ) : null}
              {porte("ports") ? (
                <Lu label="Ports" valeur={item.ports} titre="Nombre de ports" />
              ) : null}
            </Rangee>
            {porte("administration") ? (
              <Rangee>
                <LuBloc label="Administration" facultatif>
                  {item.managementUrl ? (
                    <a
                      href={item.managementUrl}
                      target="_blank"
                      rel="noopener"
                      className="text-truncate d-block"
                    >
                      {item.managementUrl}
                    </a>
                  ) : null}
                </LuBloc>
              </Rangee>
            ) : null}
          </>
        ) : null}

        {porte("virtualisation") ? (
          <Rangee>
            <Lu label="Serveur hôte" valeur={item.hostServer} />
            <Lu label="Hyperviseur" valeur={item.hypervisor} />
            <Lu label="vCPU" valeur={item.vcpu} />
            <Lu label="RAM (Go)" valeur={item.ramGo} />
            <Lu label="Stockage (Go)" valeur={stockage} />
          </Rangee>
        ) : null}

        {porte("materiel") ? (
          <>
            <Rangee>
              <Lu label="Modèle" valeur={item.manufacturerModel} titre="Constructeur / Modèle" />
              <Lu label="N° de série" valeur={item.serialNumber} />
              <Lu label="Service Tag" valeur={item.serviceTag} />
            </Rangee>
            <Rangee>
              <Lu label="Emplacement" valeur={item.location} />
              <Lu
                label="Achat / MES"
                valeur={item.purchaseDate ? dateCourte(item.purchaseDate) : null}
                titre="Date achat / mise en service"
              />
              <Lu
                label="Fin de garantie"
                valeur={item.warrantyEnd ? dateCourte(item.warrantyEnd) : null}
              />
              <Lu
                label="Maintenance"
                valeur={item.maintenanceContract}
                titre="Contrat de maintenance"
              />
            </Rangee>
          </>
        ) : null}

        {porte("stockage") ? (
          <Rangee>
            <Lu label="Protocoles" valeur={item.protocols} />
            <Lu label="Capacité (To)" valeur={item.capacityTo} />
            <Lu label="Utilisé (To)" valeur={item.usedTo} />
            <Lu label="RAID" valeur={item.raid} />
            <Lu label="Accès" valeur={item.access} titre="Accès (utilisateurs / groupes)" />
          </Rangee>
        ) : null}

        <Rangee>
          <Lu
            label="Sauvegarde 1"
            valeur={`${item.backup1 ?? ""}${item.backup1Freq ? ` (${item.backup1Freq})` : ""}`.trim()}
          />
          {porte("virtualisation") ? (
            <Lu
              label="Sauvegarde 2"
              valeur={`${item.backup2 ?? ""}${item.backup2Freq ? ` (${item.backup2Freq})` : ""}`.trim()}
            />
          ) : null}
          {porte("pra") ? <Lu label="PRA / PCA" valeur={item.praPca} /> : null}
        </Rangee>
        {!item.backup1 && !item.backup2 ? (
          <span className="lu-vide text-danger small">
            <Icone bi="bi-exclamation-triangle" taille="1em" classes="me-1" />
            Aucune sauvegarde renseignée.
          </span>
        ) : null}
      </Rubrique>

      <Rubrique titre="Notes" bi="bi-journal-text" couleur="slate">
        <Rangee>
          <Lu label="Observations" valeur={item.observations} large />
        </Rangee>
      </Rubrique>

      <div className="px-3 py-2 border-top small text-muted">
        {item.createdAt ? `Créé le ${dateCourte(item.createdAt)}` : ""}
        {item.updatedAt ? ` · dernière modification le ${dateCourte(item.updatedAt)}` : ""}
      </div>
    </div>
  );
}
