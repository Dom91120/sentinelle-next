/** Les gabarits des revues de droits (port de reviews/_form_corps.html et _synthese.html). */
import type { AccessReview, Software } from "@/generated/prisma/client";
import { PiedForm, RubriqueForm } from "@/components/formulaire";
import { Lu, LuBloc, Rangee, Rubrique } from "@/components/synthese";
import { isoDate } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import type { CurrentUser } from "@/server/guards";

export type ReviewComplete = AccessReview & { software: Software | null };

export type FormProps = {
  review: AccessReview | null;
  assets: Software[];
  user: CurrentUser;
  csrf: string;
  retour: string;
  actionForm?: string;
};

/** reviews/_form_corps.html */
export function FormCorps({ review, assets, user, csrf, retour, actionForm }: FormProps) {
  const assetNames = new Set(assets.map((a) => a.name));
  const horsInventaire = review?.application && !assetNames.has(review.application);
  return (
    <div className="form-seul">
      <form method="POST" id="form-principal" className="formulaire fiche-saisie" data-edition-visible action={actionForm}>
        <input type="hidden" name="csrf_token" value={csrf} />
        <div className="data-card mb-3">
          <RubriqueForm titre="Revue" icone="bi-person-check" couleur="indigo">
            <div className="row">
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Application métier *</label>
                <select name="application" id="reviewApp" className="form-select l-contenu" required defaultValue={review?.application ?? ""}>
                  <option value="">— Choisir une application —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                  {horsInventaire ? <option value={review.application}>{review.application} (hors inventaire)</option> : null}
                </select>
              </div>
              <div className="col-md mb-3">
                <label className="form-label fw-medium">Responsable</label>
                <input type="text" name="responsible" className="form-control" defaultValue={review?.responsible ?? ""} data-ad-search="" data-ad-email="responsible_email" placeholder="Rechercher dans l'annuaire (AD)..." />
              </div>
              <div className="col-md mb-3">
                <label className="form-label fw-medium">Email du responsable</label>
                <input type="email" name="responsible_email" className="form-control" defaultValue={review?.responsibleEmail ?? ""} placeholder="responsable@collectivite.fr" />
              </div>
            </div>
            <div className="row">
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Fréquence (jours)</label>
                <input type="number" name="frequency_days" className="form-control l-jours" defaultValue={review ? (review.frequencyDays ?? "") : 365} />
              </div>
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Dernière revue</label>
                <input type="date" name="last_review" className="form-control l-date" defaultValue={review?.lastReview ? isoDate(review.lastReview) : ""} />
              </div>
              <div className="col-md-auto mb-3">
                <label className="form-label fw-medium">Prochaine revue</label>
                <input type="date" name="next_review" className="form-control l-date" defaultValue={review?.nextReview ? isoDate(review.nextReview) : ""} />
              </div>
            </div>
          </RubriqueForm>

          <RubriqueForm titre="Périmètre" icone="bi-journal-text" couleur="slate">
            <div className="mb-3">
              <label className="form-label fw-medium">Périmètre / notes</label>
              <textarea name="scope" className="form-control" rows={3} placeholder="Comptes concernés, profils, points à vérifier..." defaultValue={review?.scope ?? ""} />
            </div>
          </RubriqueForm>
        </div>

        <PiedForm retour={retour} libelle={review ? "Enregistrer" : "Ajouter"} supprimer={review && user.canDelete("reviews") ? `/reviews/${review.id}/delete` : null} confirmation="Supprimer cette revue ?" />
      </form>
    </div>
  );
}

/** reviews/_synthese.html */
export function Synthese({ review }: { review: ReviewComplete }) {
  return (
    <div className="data-card mb-3 synthese synthese--cases" style={{ "--lu-intitule": "80px" } as React.CSSProperties}>
      <Rubrique titre="Revue" bi="bi-person-check" couleur="indigo">
        <Rangee>
          <LuBloc label="Logiciel">
            {review.software ? (
              <a href={`/software/${review.softwareId}`}>{review.software.name}</a>
            ) : (
              <span title="Hors inventaire des logiciels">
                {review.application} <span className="text-muted fw-normal">(hors inventaire)</span>
              </span>
            )}
          </LuBloc>
          <Lu label="Responsable" valeur={review.responsible} />
          <LuBloc label="Courriel">
            {review.responsibleEmail ? (
              <a href={`mailto:${review.responsibleEmail}`} className="text-truncate d-block">
                {review.responsibleEmail}
              </a>
            ) : null}
          </LuBloc>
        </Rangee>
        <Rangee>
          <Lu label="Fréquence" valeur={review.frequencyDays ? `Tous les ${review.frequencyDays} jours` : null} />
          <Lu label="Dernière revue" valeur={review.lastReview ? dateCourte(review.lastReview) : null} facultatif />
        </Rangee>
      </Rubrique>

      <Rubrique titre="Périmètre" bi="bi-journal-text" couleur="slate">
        <Rangee>
          <Lu label="Périmètre" valeur={review.scope} large titre="Ce que la revue couvre" />
        </Rangee>
      </Rubrique>
    </div>
  );
}
