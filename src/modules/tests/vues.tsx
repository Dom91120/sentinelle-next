/** Les gabarits des tests (port de tests/_form_corps.html et _synthese.html). */

import { PiedForm, RubriqueForm } from "@/components/formulaire";
import { Lu, Rangee, Rubrique } from "@/components/synthese";
import type { Software, TestTask } from "@/generated/prisma/client";
import { TEST_TYPES } from "@/lib/constantes";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import type { CurrentUser } from "@/server/guards";

export type FormProps = {
  test: TestTask | null;
  softwareList: Software[];
  user: CurrentUser;
  csrf: string;
  retour: string;
  actionForm?: string;
};

/** tests/_form_corps.html */
export function FormCorps({ test, softwareList, user, csrf, retour, actionForm }: FormProps) {
  return (
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
          <RubriqueForm titre="Test" icone="bi-clipboard-check" couleur="emerald">
            <div className="row">
              <div className="col-md mb-3">
                <label className="form-label fw-medium">Nom du test *</label>
                <input
                  type="text"
                  name="name"
                  className="form-control"
                  defaultValue={test?.name ?? ""}
                  required
                  placeholder="ex: Restauration base SQL prod"
                />
              </div>
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Logiciel concerné</label>
                <select
                  name="software_id"
                  className="form-select l-contenu"
                  defaultValue={test?.softwareId ?? ""}
                >
                  <option value="">— Aucun —</option>
                  {softwareList.map((sw) => (
                    <option key={sw.id} value={sw.id}>
                      {sw.name}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  Mise à jour annuelle, purge, revue des comptes… La tâche apparaît alors sur la
                  fiche du logiciel.
                </div>
              </div>
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Type de test *</label>
                <select
                  name="test_type"
                  className="form-select l-contenu"
                  required
                  defaultValue={test?.testType ?? TEST_TYPES[0][0]}
                >
                  {TEST_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row">
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Derniere execution</label>
                <input
                  type="date"
                  name="last_performed"
                  className="form-control l-date"
                  defaultValue={test?.lastPerformed ? isoDate(test.lastPerformed) : ""}
                />
              </div>
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Prochaine echeance</label>
                <input
                  type="date"
                  name="next_due"
                  className="form-control l-date"
                  defaultValue={test?.nextDue ? isoDate(test.nextDue) : ""}
                />
              </div>
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Frequence (jours) *</label>
                <input
                  type="number"
                  name="frequency_days"
                  className="form-control l-jours"
                  defaultValue={test ? (test.frequencyDays ?? "") : 90}
                  min={1}
                  required
                />
              </div>
            </div>
          </RubriqueForm>

          <RubriqueForm titre="Procédure" icone="bi-journal-text" couleur="slate">
            <div className="mb-3">
              <label className="form-label fw-medium">Description de la procédure</label>
              <textarea
                name="description"
                className="form-control"
                rows={4}
                placeholder="Decrivez la procedure de test..."
                defaultValue={test?.description ?? ""}
              />
            </div>
          </RubriqueForm>
        </div>

        <PiedForm
          retour={retour}
          libelle={test ? "Enregistrer" : "Ajouter"}
          supprimer={test && user.canDelete("tests") ? `/tests/${test.id}/delete` : null}
          confirmation="Supprimer ce test ?"
        />
      </form>
    </div>
  );
}

/** tests/_synthese.html */
export function Synthese({ test, typeLabel }: { test: TestTask; typeLabel: string }) {
  return (
    <div
      className="data-card mb-3 synthese synthese--cases"
      style={{ "--lu-intitule": "75px" } as React.CSSProperties}
    >
      <Rubrique titre="Test" bi="bi-clipboard-check" couleur="emerald">
        <Rangee>
          <Lu label="Type" valeur={typeLabel} />
          <Lu
            label="Fréquence"
            valeur={test.frequencyDays ? `Tous les ${test.frequencyDays} jours` : null}
          />
        </Rangee>
        <Rangee>
          <Lu
            label="Exécuté le"
            valeur={test.lastPerformed ? dateCourte(test.lastPerformed) : null}
            titre="Dernière exécution"
            facultatif
          />
          <Lu
            label="Échéance"
            valeur={test.nextDue ? dateCourte(test.nextDue) : null}
            titre="Prochaine échéance"
          />
        </Rangee>
        <Rangee>
          <Lu label="Résultat du dernier test" valeur={test.result} large facultatif />
        </Rangee>
      </Rubrique>

      <Rubrique titre="Procédure" bi="bi-journal-text" couleur="slate">
        <Rangee>
          <Lu label="Procédure" valeur={test.description} large />
        </Rangee>
      </Rubrique>
    </div>
  );
}
