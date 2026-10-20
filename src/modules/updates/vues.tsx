/** Les gabarits des mises à jour (port de updates/_form_corps.html et _synthese.html). */
import type { Equipment, Software, SystemUpdate } from "@/generated/prisma/client";
import { PiedForm, RubriqueForm } from "@/components/formulaire";
import { EquipmentSelect } from "@/components/partials";
import { ScriptDiffere } from "@/components/scripts";
import { Lu, Pastille, Rangee, Rubrique } from "@/components/synthese";
import { EQUIPMENT_KIND_ICONS, EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { type Asset, STATUS_CHOICES, STATUS_LABELS, TYPE_CHOICES, TYPE_LABELS } from "@/modules/updates/server";
import type { CurrentUser } from "@/server/guards";

export type UpdateComplete = SystemUpdate & { software: Software | null; equipment: Equipment | null };

const PICKER_JS = `(function () {
    var typeSel = document.getElementById('systemType');
    var picker = document.getElementById('assetPicker');
    var nameInput = document.getElementById('assetName');
    if (!typeSel || !picker || !nameInput) return;
    function filterPicker() {
        var want = typeSel.value;
        Array.prototype.forEach.call(picker.options, function (o) {
            if (!o.value) { o.hidden = false; return; }
            o.hidden = (o.dataset.type !== want);
        });
        if (picker.selectedOptions[0] && picker.selectedOptions[0].hidden) picker.value = '';
    }
    picker.addEventListener('change', function () { if (picker.value) nameInput.value = picker.value; });
    typeSel.addEventListener('change', filterPicker);
    filterPicker();
})();`;

export type FormProps = {
  update: SystemUpdate | null;
  assets: Asset[];
  equipments: Equipment[];
  user: CurrentUser;
  csrf: string;
  nonce?: string;
  retour: string;
  actionForm?: string;
};

/** updates/_form_corps.html */
export function FormCorps({ update, assets, equipments, user, csrf, nonce, retour, actionForm }: FormProps) {
  return (
    <>
      <div className="form-seul">
        <form method="POST" id="form-principal" className="formulaire fiche-saisie" data-edition-visible action={actionForm}>
          <input type="hidden" name="csrf_token" value={csrf} />
          <div className="data-card mb-3">
            <RubriqueForm titre="Mise à jour" icone="bi-arrow-up-circle" couleur="sky">
              <div className="row">
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Type</label>
                  <select name="system_type" id="systemType" className="form-select l-contenu" defaultValue={update?.systemType ?? TYPE_CHOICES[0][0]}>
                    {TYPE_CHOICES.map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Matériel / Application</label>
                  <select id="assetPicker" className="form-select l-contenu" defaultValue="">
                    <option value="">— Sélectionner —</option>
                    {assets.map((a) => (
                      <option key={`${a.assetType}:${a.name}`} value={a.name} data-type={a.assetType}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md mb-3">
                  <label className="form-label fw-medium">Nom *</label>
                  <input type="text" name="name" id="assetName" className="form-control" required defaultValue={update?.name ?? ""} placeholder="ou saisie libre" />
                </div>
              </div>
              <div className="row">
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Version actuelle</label>
                  <input type="text" name="current_version" className="form-control l-version" defaultValue={update?.currentVersion ?? ""} placeholder="ex: 1.2.3" />
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium" title="Dernière version disponible">
                    Dernière version
                  </label>
                  <input type="text" name="latest_version" className="form-control l-version" defaultValue={update?.latestVersion ?? ""} placeholder="ex: 1.3.0" />
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium" title="Dernière mise à jour">
                    Dernière MAJ
                  </label>
                  <input type="date" name="last_update" className="form-control l-date" defaultValue={update?.lastUpdate ? isoDate(update.lastUpdate) : ""} />
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Statut *</label>
                  <select name="status" className="form-select l-contenu" defaultValue={update?.status ?? STATUS_CHOICES[0][0]}>
                    {STATUS_CHOICES.map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row">
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Réalisée par</label>
                  <select name="updater_type" className="form-select l-contenu" defaultValue={update?.updaterType === "prestataire" ? "prestataire" : "interne"}>
                    <option value="interne">Interne</option>
                    <option value="prestataire">Prestataire</option>
                  </select>
                </div>
                <div className="col-md mb-3">
                  <label className="form-label fw-medium">Nom de la personne</label>
                  <input type="text" name="updated_by" className="form-control" defaultValue={update?.updatedBy ?? ""} placeholder="ex: Jean Dupont (DSI) ou Société XYZ" />
                </div>
              </div>
              <div className="mb-3">
                <EquipmentSelect equipments={equipments} selectedId={update?.equipmentId} user={user} csrf={csrf} />
              </div>
            </RubriqueForm>

            <RubriqueForm titre="Notes" icone="bi-journal-text" couleur="slate">
              <div className="mb-3">
                <label className="form-label fw-medium">Description / notes</label>
                <textarea name="description" className="form-control" rows={3} placeholder="Notes de version, criticité, dépendances..." defaultValue={update?.description ?? ""} />
              </div>
            </RubriqueForm>
          </div>

          <PiedForm retour={retour} libelle={update ? "Enregistrer" : "Ajouter"} supprimer={update && user.canDelete("updates") ? `/updates/${update.id}/delete` : null} confirmation="Supprimer cette entrée ?" />
        </form>
      </div>

      <ScriptDiffere code={PICKER_JS} nonce={nonce} />
    </>
  );
}

/** updates/_synthese.html */
export function Synthese({ update }: { update: UpdateComplete }) {
  const eq = update.equipment;
  return (
    <div className="data-card mb-3 synthese synthese--cases" style={{ "--lu-intitule": "75px" } as React.CSSProperties}>
      <Rubrique titre="Mise à jour" bi="bi-arrow-up-circle" couleur="sky">
        <Rangee>
          <Lu label="Type" valeur={TYPE_LABELS[update.systemType ?? ""] ?? update.systemType} />
          <Lu label="Statut" valeur={STATUS_LABELS[update.status ?? ""] ?? update.status} />
        </Rangee>
        <Rangee>
          <Lu label="Réalisée par" valeur={update.updatedBy} />
          <Lu label="Intervenant" valeur={update.updatedBy ? (update.updaterType === "prestataire" ? "Prestataire" : "Interne") : null} facultatif />
          <Lu label="Dernière MAJ" valeur={update.lastUpdate ? dateCourte(update.lastUpdate) : null} titre="Dernière mise à jour" />
        </Rangee>
      </Rubrique>

      {update.software || eq ? (
        <Rubrique titre="Concerne" bi="boxes" couleur="violet">
          <div className="pastilles">
            {update.software ? <Pastille url={`/inventory/logiciels/${update.software.id}`} nomIcone="app-window" nom={update.software.name} teinte="software" titre={`Logiciel concerné${update.software.version ? ` · v${update.software.version}` : ""}`} /> : null}
            {eq ? <Pastille url={`/inventory/${eq.id}`} nomIcone={EQUIPMENT_KIND_ICONS[eq.kind ?? "vm"] ?? "server"} nom={eq.name} teinte={eq.kind || "vm"} titre={`Équipement concerné · ${EQUIPMENT_KIND_LABELS[eq.kind ?? ""] ?? eq.kind ?? ""}`} /> : null}
          </div>
        </Rubrique>
      ) : null}

      <Rubrique titre="Notes" bi="bi-journal-text" couleur="slate">
        <Rangee>
          <Lu label="Notes" valeur={update.description} large />
        </Rangee>
      </Rubrique>
    </div>
  );
}
