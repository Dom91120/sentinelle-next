import { notFound } from "next/navigation";
import { BoutonModal, Entete, FaitBloc, Faits, ModalAction } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import { isoDate } from "@/lib/forms-util";
import { aujourdhui, dateHeure, diffJours } from "@/lib/libelles";
import { backupComputedStatus, backupLastOkCheck, backupStreak, backupSuccessRate, backupTodayCheck } from "@/lib/statuts";
import { BACKUP_TYPE_LABELS_FEM, FREQ_LABELS_LOWER, formContext } from "@/modules/backups/server";
import { FormCorps, Synthese } from "@/modules/backups/vues";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";
import { getActiveSnooze } from "@/server/snooze";

/** backups/detail.html */
export default async function BackupDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("backups");
  const id = idDeRoute((await params).id);
  const backup = await prisma.backup.findUnique({ where: { id }, include: { equipment: true, checks: { orderBy: { checkDate: "desc" } } } });
  if (!backup) notFound();
  const { user, csrf } = page;
  const peutEditer = user.canEdit("backups");
  const [checkEvents, voisins, ctx, snooze] = await Promise.all([
    prisma.backupHistory.findMany({ where: { backupId: id, action: "check" }, orderBy: { performedAt: "desc" }, take: 200 }),
    voisinsDe("backup", id, "serviceName", page),
    peutEditer ? formContext() : Promise.resolve({ equipments: [] }),
    getActiveSnooze("backup", id),
  ]);
  const checks = backup.checks;
  const statut = backupComputedStatus(backup, checks);
  const freqLabel = FREQ_LABELS_LOWER[backup.frequency ?? ""] ?? backup.frequency ?? "";
  const typeLabel = BACKUP_TYPE_LABELS_FEM[backup.backupType ?? ""] ?? backup.backupType ?? "";
  const tc = backupTodayCheck(checks);
  const rate = backupSuccessRate(checks, 30);
  const lastOk = backupLastOkCheck(checks);
  const d = lastOk ? diffJours(aujourdhui(), lastOk.checkDate) : null;
  const sousTitre = `Sauvegarde ${freqLabel}${backup.expectedTime ? ` à ${backup.expectedTime}` : ""}${typeLabel ? ` · ${typeLabel}` : ""}${backup.location ? ` · ${backup.location}` : ""}`;
  const bandeau = (
    <div className={`data-card fiche-bandeau fiche-bandeau--${statut}`}>
      <Faits>
        <FaitBloc label="Aujourd'hui">
          {tc ? (
            tc.status === "ok" ? (
              <span className="text-success">
                <Icone bi="bi-check-circle" taille="1em" classes="me-1" />
                OK
              </span>
            ) : tc.status === "failed" ? (
              <span className="text-danger">
                <Icone bi="bi-x-circle" taille="1em" classes="me-1" />
                Échec
              </span>
            ) : (
              <span className="text-warning">
                <Icone bi="bi-exclamation-triangle" taille="1em" classes="me-1" />
                Avertissement
              </span>
            )
          ) : (
            <span className="text-muted">non vérifiée</span>
          )}
        </FaitBloc>
        <FaitBloc label="Dernier OK">{d === null ? <span className="text-muted">jamais</span> : d === 0 ? "aujourd'hui" : `il y a ${d} j`}</FaitBloc>
        <FaitBloc label="Série OK">
          {backupStreak(checks)} <small>jour(s)</small>
        </FaitBloc>
        <FaitBloc label="Réussite 30 j">{rate !== null ? <span className={rate >= 95 ? "text-success" : rate >= 80 ? "text-warning" : "text-danger"}>{rate} %</span> : <span className="text-muted">—</span>}</FaitBloc>
      </Faits>
    </div>
  );
  return (
    <>
      <title>{`${backup.serviceName} - Sentinelle`}</title>
      <Entete titre={backup.serviceName} sousTitre={sousTitre} statut={statut} primaire={peutEditer ? <BoutonModal id="check" libelle="Enregistrer un check" icone="bi-check2-square" /> : null} menu={[]} voisins={voisins} base="/backups" bandeau={bandeau} />

      <BarreOnglets id="ficheBackup" modifier={peutEditer ? `/backups/${id}/edit` : null} surPlace>
        <Onglet cible="detail" libelle="Synthèse" icone="bi-card-text" actif />
        {peutEditer ? <Onglet cible="details" libelle="Détails" icone="bi-pencil-square" /> : null}
        <Onglet cible="historique-des" libelle="Historique des checks" icone="bi-clock-history" compteur={checkEvents.length} />
      </BarreOnglets>

      <Volets>
        <Volet cible="detail" actif>
          <div className="row g-3">
            <div className="col-lg-9">
              <Synthese backup={backup} />
            </div>
            <div className="col-lg-3">
              <SnoozeCard entityType="backup" entityId={id} user={user} snooze={snooze} csrf={csrf} />
            </div>
          </div>
        </Volet>

        {peutEditer ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormCorps backup={backup} {...ctx} user={user} csrf={csrf} retour={`/backups/${id}#details`} actionForm={`/backups/${id}/edit`} />
            </fieldset>
          </Volet>
        ) : null}

        <Volet cible="historique-des">
          <div className="data-card">
            <div className="card-header-custom">
              <div>
                <h6 className="fw-bold mb-0">
                  <Icone bi="bi-clock-history" taille="1em" classes="me-2" />
                  Historique des checks
                </h6>
                <small className="text-muted">Toutes les saisies, y compris plusieurs le même jour. Les statistiques retiennent le premier statut du jour ; l'état actuel reflète le dernier.</small>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Statut</th>
                    <th>Date et heure</th>
                    <th>Détail</th>
                    <th>Vérifié par</th>
                  </tr>
                </thead>
                <tbody>
                  {checkEvents.length ? (
                    checkEvents.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {e.status === "ok" ? (
                            <span className="badge-status badge-success">OK</span>
                          ) : e.status === "failed" ? (
                            <span className="badge-status badge-danger">Échec</span>
                          ) : e.status === "warning" ? (
                            <span className="badge-status badge-warning">Avertissement</span>
                          ) : (
                            <span className="badge-status badge-muted">—</span>
                          )}
                        </td>
                        <td className="text-nowrap">{dateHeure(e.performedAt)}</td>
                        <td>{e.comment || "—"}</td>
                        <td className="text-nowrap">{e.performedBy || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-3 text-muted">
                        Aucun check enregistré
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Volet>
      </Volets>

      {peutEditer ? (
        <ModalAction id="check" titre="Enregistrer un check" action={`/backups/${id}/check`} csrf={csrf} bouton="Enregistrer" icone="bi-check2-square" aide="Le résultat de la sauvegarde pour la date choisie. Plusieurs saisies le même jour sont possibles : la dernière fait l'état courant.">
          <div className="row g-3">
            <div className="col-6">
              <label className="form-label" htmlFor="check_date">
                Date
              </label>
              <input type="date" name="check_date" id="check_date" className="form-control" defaultValue={isoDate(aujourdhui())} />
            </div>
            <div className="col-6">
              <label className="form-label" htmlFor="check_status">
                Résultat <span className="text-danger">*</span>
              </label>
              <select name="status" id="check_status" className="form-select" required defaultValue="ok">
                <option value="ok">OK</option>
                <option value="warning">Avertissement</option>
                <option value="failed">Échec</option>
              </select>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="check_comment">
                Commentaire
              </label>
              <textarea name="comment" id="check_comment" className="form-control" rows={2} placeholder="Que s'est-il passé ?" />
            </div>
          </div>
        </ModalAction>
      ) : null}
    </>
  );
}
