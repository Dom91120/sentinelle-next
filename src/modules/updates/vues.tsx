/** Les gabarits des mises à jour (port de updates/_form_corps.html et _synthese.html). */

import { PiedForm, RubriqueForm } from "@/components/formulaire";
import { ScriptDiffere } from "@/components/scripts";
import { Lu, Pastille, Rangee, Rubrique } from "@/components/synthese";
import type { Equipment, Software, SystemUpdate } from "@/generated/prisma/client";
import { EQUIPMENT_KIND_ICONS, EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { updateEffectiveStatus } from "@/lib/statuts";
import {
  type Asset,
  cibleValeur,
  cleanUpdater,
  miseAJourAFaire,
  type Prestataire,
  STATUS_LABELS,
  TYPE_CHOICES,
  TYPE_LABELS,
  UPDATER_CHOICES,
  UPDATER_LABELS,
} from "@/modules/updates/server";
import type { CurrentUser } from "@/server/guards";

export type UpdateComplete = SystemUpdate & {
  software: Software | null;
  equipment: Equipment | null;
};

/**
 * Le sélecteur « Matériel / Application » ne propose que les fiches du type choisi ; choisir une
 * fiche propose son nom comme libellé tant que le champ « Nom » est vide (le nom reste libre).
 */
/** « MAJ effectuée » et « Date MAJ » n'apparaissent que s'il y a quelque chose à marquer : dernière
 * version saisie différente de la version actuelle, ou « Critique » cochée (même règle que
 * miseAJourAFaire côté serveur, suivie en direct pendant la saisie) ; masqués, ils sont remis à
 * zéro. L'interrupteur activé place la date du jour (locale) dans « Date MAJ » si elle est vide ;
 * l'utilisateur peut ensuite la corriger. Repassé sur off, il vide « Date MAJ ». */
const DONE_JS = `(function () {
    var done = document.getElementById('upd_done');
    var date = document.getElementById('upd_last_update');
    if (!done || !date || !done.form) return;
    var form = done.form;
    var actuelle = form.querySelector('[name="current_version"]');
    var derniere = form.querySelector('[name="latest_version"]');
    var critique = document.getElementById('upd_critical');
    var blocs = form.querySelectorAll('[data-marquage]');
    function aFaire() {
        var d = derniere ? derniere.value.trim() : '';
        var a = actuelle ? actuelle.value.trim() : '';
        return (d !== '' && d !== a) || !!(critique && critique.checked);
    }
    function rafraichir() {
        var visible = aFaire();
        blocs.forEach(function (b) { b.hidden = !visible; });
        if (!visible) { done.checked = false; date.value = ''; }
    }
    [actuelle, derniere].forEach(function (c) { if (c) c.addEventListener('input', rafraichir); });
    if (critique) critique.addEventListener('change', rafraichir);
    done.addEventListener('change', function () {
        if (!done.checked) { date.value = ''; return; }
        if (date.value) return;
        var d = new Date();
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var jj = String(d.getDate()).padStart(2, '0');
        date.value = d.getFullYear() + '-' + mm + '-' + jj;
    });
})();`;
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
    picker.addEventListener('change', function () {
        var opt = picker.selectedOptions[0];
        if (opt && opt.value && !nameInput.value.trim()) nameInput.value = opt.text;
    });
    typeSel.addEventListener('change', filterPicker);
    filterPicker();
})();
(function () {
    var qui = document.getElementById('updaterType');
    var label = document.getElementById('updatedByLabel');
    if (!qui || !label) return;
    var controles = {
        interne: { el: document.getElementById('updatedByPerson'), libelle: 'Nom de la personne' },
        prestataire: { el: document.getElementById('updatedBySupplier'), libelle: 'Prestataire' },
        autre: { el: document.getElementById('updatedByOther'), libelle: 'Intervenant' }
    };
    function basculer(vider) {
        var choix = controles[qui.value] ? qui.value : 'interne';
        label.textContent = controles[choix].libelle;
        label.htmlFor = controles[choix].el.id;
        Object.keys(controles).forEach(function (k) {
            var el = controles[k].el;
            if (!el) return;
            el.hidden = (k !== choix); el.disabled = (k !== choix);
            if (vider) el.value = '';
        });
    }
    qui.addEventListener('change', function () { basculer(true); });
    basculer(false);
})();`;

/** Le contrôle « intervenant » affiché pour chaque choix de « Réalisée par ». */
const INTERVENANT: Record<string, { id: string; libelle: string }> = {
  interne: { id: "updatedByPerson", libelle: "Nom de la personne" },
  prestataire: { id: "updatedBySupplier", libelle: "Prestataire" },
  autre: { id: "updatedByOther", libelle: "Intervenant" },
};

/** La valeur du sélecteur pour la fiche déjà rattachée (logiciel, sinon équipement). */
function cibleActuelle(update: SystemUpdate | null): string {
  if (update?.softwareId) return cibleValeur("application", update.softwareId);
  if (update?.equipmentId) return cibleValeur("system", update.equipmentId);
  return "";
}

export type FormProps = {
  update: SystemUpdate | null;
  assets: Asset[];
  prestataires: Prestataire[];
  user: CurrentUser;
  csrf: string;
  nonce?: string;
  retour: string;
  actionForm?: string;
  /** Sur une fiche enregistrée : l'interrupteur « MAJ effectuée » et « Date MAJ », visibles dès
   * qu'il y a quelque chose à marquer (versions différentes ou « Critique »), aussi pendant la saisie. */
  peutMarquer?: boolean;
};

/** updates/_form_corps.html */
export function FormCorps({
  update,
  assets,
  prestataires,
  user,
  csrf,
  nonce,
  retour,
  actionForm,
  peutMarquer,
}: FormProps) {
  const qui = cleanUpdater(update?.updaterType);
  const intervenant = update?.updatedBy ?? "";
  // État initial du bloc de marquage ; le script le suit ensuite pendant la saisie.
  const aMarquer = update ? miseAJourAFaire(update) : false;
  const valeur = (choix: string) => (qui === choix ? intervenant : "");
  // Un prestataire saisi autrefois en texte libre reste proposé, sans le perdre.
  const choixPrestataires =
    qui === "prestataire" && intervenant && !prestataires.some((p) => p.name === intervenant)
      ? [{ id: 0, name: intervenant }, ...prestataires]
      : prestataires;
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
            <RubriqueForm titre="Mise à jour" icone="bi-arrow-up-circle" couleur="sky">
              <div className="row">
                <div className="col-md mb-3">
                  <label className="form-label fw-medium">Nom *</label>
                  <input
                    type="text"
                    name="name"
                    id="assetName"
                    className="form-control"
                    required
                    defaultValue={update?.name ?? ""}
                    placeholder="Libellé de la mise à jour"
                  />
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Type</label>
                  <select
                    name="system_type"
                    id="systemType"
                    className="form-select l-contenu"
                    defaultValue={update?.systemType ?? TYPE_CHOICES[0][0]}
                  >
                    {TYPE_CHOICES.map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium" htmlFor="assetPicker">
                    Matériel / Application
                  </label>
                  <select
                    name="target"
                    id="assetPicker"
                    className="form-select l-contenu"
                    defaultValue={cibleActuelle(update)}
                  >
                    <option value="">— Aucun —</option>
                    {assets.map((a) => (
                      <option
                        key={cibleValeur(a.assetType, a.id)}
                        value={cibleValeur(a.assetType, a.id)}
                        data-type={a.assetType}
                      >
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row">
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium">Version actuelle</label>
                  <input
                    type="text"
                    name="current_version"
                    className="form-control l-version"
                    defaultValue={update?.currentVersion ?? ""}
                    placeholder="ex: 1.2.3"
                  />
                </div>
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium" title="Dernière version disponible">
                    Dernière version
                  </label>
                  <input
                    type="text"
                    name="latest_version"
                    className="form-control l-version"
                    defaultValue={update?.latestVersion ?? ""}
                    placeholder="ex: 1.3.0"
                  />
                </div>
                <div className="col-md-auto mb-3 text-center">
                  <label
                    className="form-label fw-medium d-block"
                    htmlFor="upd_critical"
                    title="Passe la fiche en rouge et envoie une alerte chaque jour tant que la mise à jour n'est pas faite"
                  >
                    Critique
                  </label>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    name="critical"
                    id="upd_critical"
                    defaultChecked={update?.status === "critical"}
                  />
                </div>
                {peutMarquer ? (
                  <>
                    <div className="col-md-auto mb-3 text-center" data-marquage hidden={!aMarquer}>
                      <label
                        className="form-label fw-medium d-block"
                        htmlFor="upd_done"
                        title="Activé, place la date du jour dans « Date MAJ » (modifiable, vidée si l'on désactive) ; à l'enregistrement, aligne la version actuelle sur la dernière disponible et passe le statut à « À jour »"
                      >
                        MAJ effectuée
                      </label>
                      <div className="form-check form-switch d-inline-block m-0 p-0">
                        <input
                          type="checkbox"
                          role="switch"
                          className="form-check-input ms-0"
                          name="done"
                          id="upd_done"
                        />
                      </div>
                    </div>
                    <div className="col-md-auto mb-3" data-marquage hidden={!aMarquer}>
                      <label
                        className="form-label fw-medium"
                        htmlFor="upd_last_update"
                        title="Date de la mise à jour (aujourd'hui dès que l'interrupteur est activé, modifiable)"
                      >
                        Date MAJ
                      </label>
                      <input
                        type="date"
                        name="last_update"
                        id="upd_last_update"
                        className="form-control l-date"
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <div className="row">
                <div className="col-md-auto mb-3">
                  <label className="form-label fw-medium" htmlFor="updaterType">
                    Réalisée par
                  </label>
                  <select
                    name="updater_type"
                    id="updaterType"
                    className="form-select l-contenu"
                    defaultValue={qui}
                  >
                    {UPDATER_CHOICES.map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Interne : une personne de l'annuaire (AD) ; prestataire : un fournisseur de
                    l'inventaire ; autre : saisie libre. Le script bascule libellé et contrôle, les
                    contrôles masqués sont désactivés (non envoyés). */}
                <div className="col-md mb-3">
                  <label
                    className="form-label fw-medium"
                    id="updatedByLabel"
                    htmlFor={INTERVENANT[qui].id}
                  >
                    {INTERVENANT[qui].libelle}
                  </label>
                  <input
                    type="text"
                    name="updated_by"
                    id="updatedByPerson"
                    data-ad-search=""
                    className="form-control"
                    defaultValue={valeur("interne")}
                    placeholder="Rechercher dans l'annuaire (AD)..."
                    hidden={qui !== "interne"}
                    disabled={qui !== "interne"}
                  />
                  <select
                    name="updated_by"
                    id="updatedBySupplier"
                    className="form-select"
                    defaultValue={valeur("prestataire")}
                    hidden={qui !== "prestataire"}
                    disabled={qui !== "prestataire"}
                  >
                    <option value="">— Sélectionner un fournisseur —</option>
                    {choixPrestataires.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="updated_by"
                    id="updatedByOther"
                    className="form-control"
                    defaultValue={valeur("autre")}
                    placeholder="ex: stagiaire, éditeur, collectivité voisine..."
                    hidden={qui !== "autre"}
                    disabled={qui !== "autre"}
                  />
                </div>
              </div>
            </RubriqueForm>

            <RubriqueForm titre="Notes" icone="bi-journal-text" couleur="slate">
              <div className="mb-3">
                <label className="form-label fw-medium">Description / notes</label>
                <textarea
                  name="description"
                  className="form-control"
                  rows={3}
                  placeholder="Notes de version, criticité, dépendances..."
                  defaultValue={update?.description ?? ""}
                />
              </div>
            </RubriqueForm>
          </div>

          <PiedForm
            retour={retour}
            libelle={update ? "Enregistrer" : "Ajouter"}
            supprimer={update && user.canDelete("updates") ? `/updates/${update.id}/delete` : null}
            confirmation="Supprimer cette entrée ?"
          />
        </form>
      </div>

      <ScriptDiffere code={PICKER_JS} nonce={nonce} />
      <ScriptDiffere code={DONE_JS} nonce={nonce} />
    </>
  );
}

/** updates/_synthese.html */
export function Synthese({ update }: { update: UpdateComplete }) {
  const eq = update.equipment;
  return (
    <div
      className="data-card mb-3 synthese synthese--cases"
      style={{ "--lu-intitule": "75px" } as React.CSSProperties}
    >
      <Rubrique titre="Mise à jour" bi="bi-arrow-up-circle" couleur="sky">
        <Rangee>
          <Lu label="Type" valeur={TYPE_LABELS[update.systemType ?? ""] ?? update.systemType} />
          <Lu
            label="Statut"
            valeur={STATUS_LABELS[updateEffectiveStatus(update)] ?? update.status}
          />
        </Rangee>
        <Rangee>
          <Lu label="Réalisée par" valeur={update.updatedBy} />
          <Lu
            label="Intervenant"
            valeur={update.updatedBy ? UPDATER_LABELS[cleanUpdater(update.updaterType)] : null}
            facultatif
          />
          <Lu
            label="Dernière MAJ"
            valeur={update.lastUpdate ? dateCourte(update.lastUpdate) : null}
            titre="Dernière mise à jour"
          />
        </Rangee>
      </Rubrique>

      {update.software || eq ? (
        <Rubrique titre="Concerne" bi="boxes" couleur="violet">
          <div className="pastilles">
            {update.software ? (
              <Pastille
                url={`/inventory/logiciels/${update.software.id}`}
                nomIcone="app-window"
                nom={update.software.name}
                teinte="software"
                titre={`Logiciel concerné${update.software.version ? ` · v${update.software.version}` : ""}`}
              />
            ) : null}
            {eq ? (
              <Pastille
                url={`/inventory/${eq.id}`}
                nomIcone={EQUIPMENT_KIND_ICONS[eq.kind ?? "vm"] ?? "server"}
                nom={eq.name}
                teinte={eq.kind || "vm"}
                titre={`Équipement concerné · ${EQUIPMENT_KIND_LABELS[eq.kind ?? ""] ?? eq.kind ?? ""}`}
              />
            ) : null}
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
