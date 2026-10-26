/** Les gabarits des comptes (port de accounts/_form_corps.html et _synthese.html). */

import { PiedForm, RubriqueForm } from "@/components/formulaire";
import { QaButton, QaModalSoftware, QaModalSupplier } from "@/components/quick-add";
import { Lu, LuBloc, Pastille, Rangee, Rubrique } from "@/components/synthese";
import type { Account, Equipment, Software, Supplier } from "@/generated/prisma/client";
import { EQUIPMENT_KIND_ICONS, EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { QaModalEquipment } from "@/modules/inventory/vues";
import type { CurrentUser } from "@/server/guards";

export type AccountComplet = Account & {
  software: Software | null;
  equipment: Equipment | null;
  supplier: Supplier | null;
};

export type FormProps = {
  account: Account | null;
  software: Software[];
  equipments: Equipment[];
  suppliers: Supplier[];
  user: CurrentUser;
  csrf: string;
  retour: string;
  actionForm?: string;
};

/** accounts/_form_corps.html */
export function FormCorps({
  account,
  software,
  equipments,
  suppliers,
  user,
  csrf,
  retour,
  actionForm,
}: FormProps) {
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
            <RubriqueForm titre="Compte" icone="bi-key" couleur="indigo">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-medium">Libellé *</label>
                  <input
                    type="text"
                    name="service_name"
                    className="form-control"
                    defaultValue={account?.serviceName ?? ""}
                    required
                    placeholder="ex: Active Directory, AWS, OVH..."
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-medium">Utilisateur *</label>
                  <input
                    type="text"
                    name="username"
                    className="form-control"
                    defaultValue={account?.username ?? ""}
                    required
                    placeholder="Nom d'utilisateur ou compte de service"
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-medium">URL / Acces</label>
                  <input
                    type="text"
                    name="url"
                    className="form-control"
                    defaultValue={account?.url ?? ""}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-4">
                  <label className="form-label fw-medium">Logiciel rattaché</label>
                  <div className="input-group">
                    <select
                      name="software_id"
                      id="accountSoftware"
                      className="form-select"
                      defaultValue={account?.softwareId ?? ""}
                    >
                      <option value="">— aucun —</option>
                      {software.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {user.canEdit("software") ? (
                      <QaButton
                        modalId="qaModalSoftware"
                        targetId="accountSoftware"
                        title="Ajouter un logiciel"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-medium">Équipement rattaché</label>
                  <div className="input-group">
                    <select
                      name="equipment_id"
                      id="accountEquipment"
                      className="form-select"
                      defaultValue={account?.equipmentId ?? ""}
                    >
                      <option value="">— aucun —</option>
                      {equipments.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    {user.canEdit("inventory") ? (
                      <QaButton
                        modalId="qaModalEquipment"
                        targetId="accountEquipment"
                        title="Ajouter un équipement"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-medium">Fournisseur rattaché</label>
                  <div className="input-group">
                    <select
                      name="supplier_id"
                      id="accountSupplier"
                      className="form-select"
                      defaultValue={account?.supplierId ?? ""}
                    >
                      <option value="">— aucun —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {user.canEdit("suppliers") ? (
                      <QaButton
                        modalId="qaModalSupplier"
                        targetId="accountSupplier"
                        title="Ajouter un fournisseur"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="form-text mb-3" data-visible>
                Facultatif ; plusieurs choix possibles : le compte admin d'un logiciel installé sur
                un serveur se rattache au logiciel et au serveur.
              </div>
            </RubriqueForm>

            <RubriqueForm
              titre="Rotation du mot de passe"
              icone="bi-arrow-repeat"
              couleur="emerald"
            >
              <div className="row">
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Dernier changement de MDP</label>
                  <input
                    type="date"
                    name="last_password_change"
                    className="form-control l-date"
                    defaultValue={isoDate(account?.lastPasswordChange)}
                  />
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Rotation (jours) *</label>
                  <input
                    type="number"
                    name="rotation_days"
                    className="form-control l-jours"
                    defaultValue={account?.rotationDays ?? 90}
                    min={1}
                    required
                  />
                </div>
              </div>
            </RubriqueForm>

            <RubriqueForm titre="Notes" icone="bi-journal-text" couleur="slate">
              <div>
                <label className="form-label">Description / Notes</label>
                <textarea
                  name="description"
                  className="form-control"
                  rows={3}
                  placeholder="Informations complementaires..."
                  defaultValue={account?.description ?? ""}
                />
              </div>
            </RubriqueForm>
          </div>

          <PiedForm
            retour={retour}
            libelle={account ? "Enregistrer" : "Ajouter"}
            supprimer={
              account && user.canDelete("accounts") ? `/accounts/${account.id}/delete` : null
            }
            confirmation="Supprimer ce compte ?"
          />
        </form>
      </div>

      {user.canEdit("software") ? <QaModalSoftware csrf={csrf} /> : null}
      {user.canEdit("inventory") ? <QaModalEquipment csrf={csrf} /> : null}
      {user.canEdit("suppliers") ? <QaModalSupplier csrf={csrf} /> : null}
    </>
  );
}

/** accounts/_synthese.html */
export function Synthese({ account }: { account: AccountComplet }) {
  return (
    <div
      className="data-card mb-3 synthese synthese--cases"
      style={{ "--lu-intitule": "75px" } as React.CSSProperties}
    >
      {/* Les rattachements (logiciel, équipement, fournisseur) sont une ligne de la
          rubrique Compte, pas une rubrique à part. */}
      <Rubrique titre="Compte" bi="bi-key" couleur="indigo">
        <Rangee>
          <Lu label="Libellé" valeur={account.serviceName} />
          <Lu label="Utilisateur" valeur={account.username} />
          <Lu label="URL / accès" valeur={account.url} />
        </Rangee>
        <Rangee>
          <LuBloc label="Rattaché à" pleine facultatif>
            <div className="pastilles">
              {account.software ? (
                <Pastille
                  url={`/inventory/logiciels/${account.softwareId}`}
                  nomIcone="app-window"
                  nom={account.software.name}
                  teinte="software"
                  titre="Logiciel"
                />
              ) : null}
              {account.equipment ? (
                <Pastille
                  url={`/inventory/${account.equipmentId}`}
                  nomIcone={EQUIPMENT_KIND_ICONS[account.equipment.kind] ?? "server"}
                  nom={account.equipment.name}
                  teinte={account.equipment.kind || "vm"}
                  titre={EQUIPMENT_KIND_LABELS[account.equipment.kind] ?? account.equipment.kind}
                />
              ) : null}
              {account.supplier ? (
                <Pastille
                  url={`/suppliers/${account.supplierId}`}
                  nomIcone="building"
                  nom={account.supplier.name}
                  teinte="supplier"
                  titre="Fournisseur"
                />
              ) : null}
            </div>
          </LuBloc>
        </Rangee>
      </Rubrique>

      <Rubrique titre="Rotation" bi="bi-arrow-repeat" couleur="sky">
        <Rangee>
          <Lu
            label="Fréquence"
            valeur={account.rotationDays ? `Tous les ${account.rotationDays} jours` : null}
          />
          <Lu
            label="Dernier chgt"
            valeur={account.lastPasswordChange ? dateCourte(account.lastPasswordChange) : null}
            titre="Dernier changement du mot de passe"
          />
          <Lu
            label="Prochain chgt"
            valeur={account.nextPasswordChange ? dateCourte(account.nextPasswordChange) : null}
            titre="Prochain changement du mot de passe"
          />
        </Rangee>
      </Rubrique>

      <Rubrique titre="Notes" bi="bi-journal-text" couleur="slate">
        <Rangee>
          <Lu label="Notes" valeur={account.description} large />
        </Rangee>
      </Rubrique>
    </div>
  );
}
