/** Les gabarits des sauvegardes (port de backups/_form_corps.html et _synthese.html). */
import type { Backup, Equipment } from "@/generated/prisma/client";
import { PiedForm, RubriqueForm } from "@/components/formulaire";
import { EquipmentSelect } from "@/components/partials";
import { Lu, Pastille, Rangee, Rubrique } from "@/components/synthese";
import { EQUIPMENT_KIND_ICONS, EQUIPMENT_KIND_LABELS } from "@/lib/constantes";
import { BACKUP_TYPE_LABELS_FEM, FREQ_LABELS_LOWER } from "@/modules/backups/server";
import type { CurrentUser } from "@/server/guards";

export type BackupComplet = Backup & { equipment: Equipment | null };

export type FormProps = {
  backup: Backup | null;
  equipments: Equipment[];
  user: CurrentUser;
  csrf: string;
  retour: string;
  actionForm?: string;
};

/** backups/_form_corps.html */
export function FormCorps({ backup, equipments, user, csrf, retour, actionForm }: FormProps) {
  return (
    <div className="form-seul">
      <form method="POST" id="form-principal" className="formulaire fiche-saisie" data-edition-visible action={actionForm}>
        <input type="hidden" name="csrf_token" value={csrf} />
        <div className="data-card mb-3">
          <RubriqueForm titre="Sauvegarde" icone="bi-cloud-arrow-up" couleur="emerald">
            <div className="row">
              <div className="col-md mb-3">
                <label className="form-label fw-medium">Service *</label>
                <input type="text" name="service_name" className="form-control" defaultValue={backup?.serviceName ?? ""} required placeholder="ex: Serveur SQL, Active Directory..." />
              </div>
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Type de backup</label>
                <select name="backup_type" className="form-select l-contenu" defaultValue={backup?.backupType ?? ""}>
                  <option value="">— Sélectionner —</option>
                  <option value="full">Complet</option>
                  <option value="incremental">Incremental</option>
                  <option value="differential">Differentiel</option>
                  <option value="snapshot">Snapshot</option>
                  <option value="other">Autre</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div className="col-md mb-3">
                <label className="form-label fw-medium">Emplacement</label>
                <input type="text" name="location" className="form-control" defaultValue={backup?.location ?? ""} placeholder="NAS, Cloud, Bande..." />
              </div>
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Frequence</label>
                <select name="frequency" className="form-select l-contenu" defaultValue={backup?.frequency ?? ""}>
                  <option value="">— Sélectionner —</option>
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Heure prevue</label>
                <input type="time" name="expected_time" className="form-control l-heure" defaultValue={backup?.expectedTime ?? ""} placeholder="ex: 02:00" />
              </div>
            </div>
            <div className="mb-3">
              <EquipmentSelect equipments={equipments} selectedId={backup?.equipmentId} user={user} csrf={csrf} />
            </div>
          </RubriqueForm>

          <RubriqueForm titre="Notes" icone="bi-journal-text" couleur="slate">
            <div className="mb-3">
              <label className="form-label fw-medium">Description / Notes</label>
              <textarea name="description" className="form-control" rows={3} placeholder="Details complementaires..." defaultValue={backup?.description ?? ""} />
            </div>
          </RubriqueForm>
        </div>

        <PiedForm retour={retour} libelle={backup ? "Enregistrer" : "Ajouter"} supprimer={backup && user.canDelete("backups") ? `/backups/${backup.id}/delete` : null} confirmation="Supprimer cette sauvegarde ?" />
      </form>
    </div>
  );
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

/** backups/_synthese.html */
export function Synthese({ backup }: { backup: BackupComplet }) {
  const typeLabel = BACKUP_TYPE_LABELS_FEM[backup.backupType ?? ""] ?? backup.backupType ?? "";
  const freqLabel = FREQ_LABELS_LOWER[backup.frequency ?? ""] ?? backup.frequency ?? "";
  const eq = backup.equipment;
  return (
    <div className="data-card mb-3 synthese synthese--cases" style={{ "--lu-intitule": "80px" } as React.CSSProperties}>
      <Rubrique titre="Sauvegarde" bi="bi-cloud-arrow-up" couleur="emerald">
        <Rangee>
          <Lu label="Type" valeur={typeLabel} />
          <Lu label="Fréquence" valeur={capitalize(freqLabel)} />
          <Lu label="Heure prévue" valeur={backup.expectedTime} />
        </Rangee>
        <Rangee>
          <Lu label="Emplacement" valeur={backup.location} />
        </Rangee>
      </Rubrique>

      {eq ? (
        <Rubrique titre="Équipement sauvegardé" bi="boxes" couleur="violet">
          <div className="pastilles">
            <Pastille url={`/inventory/${eq.id}`} nomIcone={EQUIPMENT_KIND_ICONS[eq.kind ?? "vm"] ?? "server"} nom={eq.name} teinte={eq.kind || "vm"} titre={EQUIPMENT_KIND_LABELS[eq.kind ?? "vm"] ?? eq.kind ?? ""} />
          </div>
        </Rubrique>
      ) : null}

      <Rubrique titre="Notes" bi="bi-journal-text" couleur="slate">
        <Rangee>
          <Lu label="Notes" valeur={backup.description} large />
        </Rangee>
      </Rubrique>
    </div>
  );
}
