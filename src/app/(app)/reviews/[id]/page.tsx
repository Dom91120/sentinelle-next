import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Activite,
  BandeauEcheance,
  BoutonModal,
  Entete,
  Historique,
  ModalAction,
} from "@/components/fiche";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import { dateCourte } from "@/lib/libelles";
import { reviewComputedStatus } from "@/lib/statuts";
import { formContext } from "@/modules/reviews/server";
import { FormCorps, Synthese } from "@/modules/reviews/vues";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";
import { getActiveSnooze } from "@/server/snooze";

/** reviews/detail.html */
/** Le titre de l'onglet, comme le `{% block title %}` du gabarit Jinja. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idDeRoute((await params).id);
  const fiche = await prisma.accessReview.findUnique({
    where: { id },
    select: { application: true },
  });
  return { title: fiche ? `${fiche.application} - Sentinelle` : "Sentinelle" };
}

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("reviews");
  const id = idDeRoute((await params).id);
  const review = await prisma.accessReview.findUnique({
    where: { id },
    include: { software: true },
  });
  if (!review) notFound();
  const { user, csrf } = page;
  const peutEditer = user.canEdit("reviews");
  const [histories, voisins, ctx, snooze] = await Promise.all([
    prisma.reviewHistory.findMany({ where: { reviewId: id }, orderBy: { performedAt: "desc" } }),
    voisinsDe("accessReview", id, page),
    peutEditer ? formContext() : Promise.resolve({ assets: [] }),
    getActiveSnooze("review", id),
  ]);
  const statut = reviewComputedStatus(review, seuilsDe(user.settings));
  const sousTitre = `Revue de droits${review.responsible ? ` · ${review.responsible}` : ""}${review.frequencyDays ? ` · tous les ${review.frequencyDays} j` : ""}`;
  return (
    <>
      <Entete
        titre={review.application}
        sousTitre={sousTitre}
        statut={statut}
        primaire={
          peutEditer ? (
            <BoutonModal id="valider" libelle="Valider la revue" icone="bi-check-lg" />
          ) : null
        }
        voisins={voisins}
        base="/reviews"
        bandeau={
          <BandeauEcheance
            libelle="Prochaine revue"
            date={review.nextReview}
            statut={statut}
            debut={review.lastReview}
            complement={
              review.lastReview
                ? `dernière revue le ${dateCourte(review.lastReview)}`
                : "jamais revue"
            }
            sansDate="à planifier"
          />
        }
      />

      <BarreOnglets id="ficheReview" modifier={peutEditer ? `/reviews/${id}/edit` : null} surPlace>
        <Onglet cible="detail" libelle="Synthèse" icone="bi-card-text" actif />
        {peutEditer ? <Onglet cible="details" libelle="Détails" icone="bi-pencil-square" /> : null}
        <Onglet
          cible="historique"
          libelle="Historique"
          icone="bi-clock-history"
          compteur={histories.length}
        />
      </BarreOnglets>

      <Volets>
        <Volet cible="detail" actif>
          <div className="row g-3">
            <div className="col-lg-9">
              <Synthese review={review} />
            </div>
            <div className="col-lg-3">
              <Activite histories={histories} />
              <SnoozeCard
                entityType="review"
                entityId={id}
                user={user}
                snooze={snooze}
                csrf={csrf}
              />
            </div>
          </div>
        </Volet>

        {peutEditer ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormCorps
                review={review}
                {...ctx}
                user={user}
                csrf={csrf}
                retour={`/reviews/${id}#details`}
                actionForm={`/reviews/${id}/edit`}
              />
            </fieldset>
          </Volet>
        ) : null}

        <Volet cible="historique">
          <Historique histories={histories} />
        </Volet>
      </Volets>

      {peutEditer ? (
        <ModalAction
          id="valider"
          titre="Valider la revue de droits"
          action={`/reviews/${id}/complete`}
          csrf={csrf}
          bouton="Valider la revue"
          aide="Date la revue à aujourd'hui et planifie la suivante selon la fréquence."
        >
          <div className="mb-3">
            <label className="form-label" htmlFor="outcome">
              Résultat
            </label>
            <select name="outcome" id="outcome" className="form-select" defaultValue="completed">
              <option value="completed">Conforme</option>
              <option value="failed">Écarts constatés</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="review_comment">
              Commentaire <span className="text-muted">(optionnel)</span>
            </label>
            <input
              type="text"
              name="comment"
              id="review_comment"
              className="form-control"
              placeholder="ex : 3 comptes désactivés"
            />
          </div>
        </ModalAction>
      ) : null}
    </>
  );
}
