import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Activite,
  BandeauEcheance,
  BoutonModal,
  Entete,
  Historique,
  MenuLien,
  ModalAction,
} from "@/components/fiche";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import { TEST_TYPE_LABELS } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import { testComputedStatus } from "@/lib/statuts";
import { formContext } from "@/modules/tests/server";
import { FormCorps, Synthese } from "@/modules/tests/vues";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";
import { getActiveSnooze } from "@/server/snooze";

/** tests/detail.html */
/** Le titre de l'onglet, comme le `{% block title %}` du gabarit Jinja. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idDeRoute((await params).id);
  const fiche = await prisma.testTask.findUnique({ where: { id }, select: { name: true } });
  return { title: fiche ? `${fiche.name} - Sentinelle` : "Sentinelle" };
}

export default async function TestDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("tests");
  const id = idDeRoute((await params).id);
  const test = await prisma.testTask.findUnique({ where: { id } });
  if (!test) notFound();
  const { user, csrf } = page;
  const peutEditer = user.canEdit("tests");
  const [histories, voisins, ctx, snooze] = await Promise.all([
    prisma.testHistory.findMany({ where: { testId: id }, orderBy: { performedAt: "desc" } }),
    voisinsDe("testTask", id, "name", page),
    peutEditer ? formContext() : Promise.resolve({ softwareList: [] }),
    getActiveSnooze("test", id),
  ]);
  const typeLabel = TEST_TYPE_LABELS[test.testType] ?? test.testType;
  const statut = testComputedStatus(test, seuilsDe(user.settings));
  const sousTitre = `Test récurrent${typeLabel ? ` · ${typeLabel}` : ""}${test.frequencyDays ? ` · tous les ${test.frequencyDays} j` : ""}`;
  return (
    <>
      <Entete
        titre={test.name}
        sousTitre={sousTitre}
        statut={statut}
        primaire={
          peutEditer ? (
            <BoutonModal id="effectue" libelle="Marquer effectué" icone="bi-check-lg" />
          ) : null
        }
        menu={[
          <MenuLien
            key="pdf"
            url={`/tests/${id}/pdf`}
            libelle="Exporter en PDF"
            icone="bi-file-earmark-pdf"
          />,
        ]}
        voisins={voisins}
        base="/tests"
        bandeau={
          <BandeauEcheance
            libelle="Prochaine échéance"
            date={test.nextDue}
            statut={statut}
            passe="retard"
            debut={test.lastPerformed}
            complement={
              test.lastPerformed
                ? `dernière exéc. ${dateCourte(test.lastPerformed)}`
                : "jamais exécuté"
            }
            sansDate="à planifier"
          />
        }
      />

      <BarreOnglets id="ficheTest" modifier={peutEditer ? `/tests/${id}/edit` : null} surPlace>
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
              <Synthese test={test} typeLabel={typeLabel} />
            </div>
            <div className="col-lg-3">
              <Activite histories={histories} />
              <SnoozeCard entityType="test" entityId={id} user={user} snooze={snooze} csrf={csrf} />
            </div>
          </div>
        </Volet>

        {peutEditer ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormCorps
                test={test}
                {...ctx}
                user={user}
                csrf={csrf}
                retour={`/tests/${id}#details`}
                actionForm={`/tests/${id}/edit`}
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
          id="effectue"
          titre="Marquer le test effectué"
          action={`/tests/${id}/complete`}
          csrf={csrf}
          bouton="Marquer effectué"
          aide="Date l'exécution à aujourd'hui et recalcule la prochaine échéance selon la fréquence."
        >
          <div className="mb-3">
            <label className="form-label" htmlFor="outcome">
              Résultat
            </label>
            <select name="outcome" id="outcome" className="form-select" defaultValue="completed">
              <option value="completed">Réussi</option>
              <option value="failed">Échoué</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="result">
              Détails du résultat
            </label>
            <textarea
              name="result"
              id="result"
              className="form-control"
              rows={3}
              placeholder="Ce qui a été vérifié, ce qui a été constaté…"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="test_comment">
              Commentaire <span className="text-muted">(optionnel)</span>
            </label>
            <input type="text" name="comment" id="test_comment" className="form-control" />
          </div>
        </ModalAction>
      ) : null}
    </>
  );
}
