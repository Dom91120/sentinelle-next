import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Activite, Entete, Fait, FaitBloc, Faits, Historique } from "@/components/fiche";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import { dateCourte } from "@/lib/libelles";
import { updateEffectiveStatus, updateStatusColor } from "@/lib/statuts";
import { formContext, STATUS_LABELS, TYPE_LABELS } from "@/modules/updates/server";
import { FormCorps, Synthese } from "@/modules/updates/vues";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";
import { getActiveSnooze } from "@/server/snooze";

/** updates/detail.html */
/** Le titre de l'onglet, comme le `{% block title %}` du gabarit Jinja. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idDeRoute((await params).id);
  const fiche = await prisma.systemUpdate.findUnique({ where: { id }, select: { name: true } });
  return { title: fiche ? `${fiche.name} - Sentinelle` : "Sentinelle" };
}

export default async function UpdateDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("updates");
  const id = idDeRoute((await params).id);
  const update = await prisma.systemUpdate.findUnique({
    where: { id },
    include: { software: true, equipment: true },
  });
  if (!update) notFound();
  const { user, csrf, nonce } = page;
  const peutEditer = user.canEdit("updates");
  const [histories, voisins, ctx, snooze] = await Promise.all([
    prisma.updateHistory.findMany({ where: { updateId: id }, orderBy: { performedAt: "desc" } }),
    voisinsDe("systemUpdate", id, page),
    peutEditer ? formContext() : Promise.resolve({ assets: [], prestataires: [] }),
    getActiveSnooze("update", id),
  ]);
  const couleur = updateStatusColor(update);
  const sousTitre = `${TYPE_LABELS[update.systemType ?? ""] ?? update.systemType ?? ""}${update.currentVersion ? ` · version ${update.currentVersion}` : ""}`;
  return (
    <>
      <Entete
        titre={update.name}
        sousTitre={sousTitre}
        badges={
          <span className={`badge-status badge-${couleur}`}>
            {STATUS_LABELS[updateEffectiveStatus(update)] ?? update.status}
          </span>
        }
        voisins={voisins}
        base="/updates"
        bandeau={
          <div className={`data-card fiche-bandeau fiche-bandeau--${couleur}`}>
            <Faits>
              <FaitBloc label="Version actuelle">
                <code>{update.currentVersion || "—"}</code>
              </FaitBloc>
              <FaitBloc label="Dernière disponible">
                <code>{update.latestVersion || "—"}</code>
              </FaitBloc>
              <Fait
                label="Dernière MAJ"
                value={update.lastUpdate ? dateCourte(update.lastUpdate) : null}
              />
            </Faits>
          </div>
        }
      />

      <BarreOnglets id="ficheUpdate" modifier={peutEditer ? `/updates/${id}/edit` : null} surPlace>
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
              <Synthese update={update} />
            </div>
            <div className="col-lg-3">
              <Activite histories={histories} />
              <SnoozeCard
                entityType="update"
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
                update={update}
                {...ctx}
                user={user}
                csrf={csrf}
                nonce={nonce}
                retour={`/updates/${id}#details`}
                actionForm={`/updates/${id}/edit`}
                peutMarquer
              />
            </fieldset>
          </Volet>
        ) : null}

        <Volet cible="historique">
          <Historique histories={histories} />
        </Volet>
      </Volets>
    </>
  );
}
