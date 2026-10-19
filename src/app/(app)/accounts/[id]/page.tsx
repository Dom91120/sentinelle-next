import { notFound } from "next/navigation";
import { Activite, BandeauEcheance, BoutonModal, Entete, Historique, MenuLien, ModalAction } from "@/components/fiche";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import { isoDate } from "@/lib/forms-util";
import { aujourdhui, dateCourte } from "@/lib/libelles";
import { accountStatus } from "@/lib/statuts";
import { formContext } from "@/modules/accounts/server";
import { FormCorps, Synthese } from "@/modules/accounts/vues";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";
import { getActiveSnooze } from "@/server/snooze";

/** accounts/detail.html */
export default async function AccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("accounts");
  const id = idDeRoute((await params).id);
  const account = await prisma.account.findUnique({ where: { id }, include: { software: true, equipment: true, supplier: true } });
  if (!account) notFound();
  const { user, csrf } = page;
  const peutEditer = user.canEdit("accounts");
  const [histories, voisins, ctx, snooze] = await Promise.all([
    prisma.accountHistory.findMany({ where: { accountId: id }, orderBy: { performedAt: "desc" } }),
    voisinsDe("account", id, "serviceName", page),
    peutEditer ? formContext() : Promise.resolve({ software: [], equipments: [], suppliers: [] }),
    getActiveSnooze("account", id),
  ]);
  const statut = accountStatus(account, seuilsDe(user.settings));
  const complement = `${account.rotationDays ? `rotation ${account.rotationDays} j` : ""}${account.lastPasswordChange ? ` · dernier chgt ${dateCourte(account.lastPasswordChange)}` : ""}`;
  const today = isoDate(aujourdhui());
  return (
    <>
      <title>{`${account.serviceName} - Sentinelle`}</title>
      <Entete
        titre={account.serviceName}
        sousTitre={
          <>
            Compte <strong>{account.username}</strong>
            {account.url ? ` · ${account.url}` : ""}
          </>
        }
        statut={statut}
        primaire={peutEditer ? <BoutonModal id="mdp-change" libelle="Mot de passe changé" icone="bi-key" /> : null}
        menu={[<MenuLien key="pdf" url={`/accounts/${id}/pdf`} libelle="Exporter en PDF" icone="bi-file-earmark-pdf" />]}
        voisins={voisins}
        base="/accounts"
        bandeau={<BandeauEcheance libelle="Prochain chgt" date={account.nextPasswordChange} statut={statut} debut={account.lastPasswordChange} complement={complement} sansDate="date de rotation à renseigner" />}
      />

      <BarreOnglets id="ficheAccount" modifier={peutEditer ? `/accounts/${id}/edit` : null} surPlace>
        <Onglet cible="detail" libelle="Synthèse" icone="bi-card-text" actif />
        {peutEditer ? <Onglet cible="details" libelle="Détails" icone="bi-pencil-square" /> : null}
        <Onglet cible="historique" libelle="Historique" icone="bi-clock-history" compteur={histories.length} />
      </BarreOnglets>

      <Volets>
        <Volet cible="detail" actif>
          <div className="row g-3">
            <div className="col-lg-9">
              <Synthese account={account} />
            </div>
            <div className="col-lg-3">
              <Activite histories={histories} />
              <SnoozeCard entityType="account" entityId={id} user={user} snooze={snooze} csrf={csrf} />
            </div>
          </div>
        </Volet>

        {peutEditer ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormCorps account={account} {...ctx} user={user} csrf={csrf} retour={`/accounts/${id}#details`} actionForm={`/accounts/${id}/edit`} />
            </fieldset>
          </Volet>
        ) : null}

        <Volet cible="historique">
          <Historique histories={histories} />
        </Volet>
      </Volets>

      {peutEditer ? (
        <ModalAction id="mdp-change" titre="Mot de passe changé" action={`/accounts/${id}/password-changed`} csrf={csrf} bouton="Enregistrer le changement" icone="bi-key" aide="Repart le compte à rebours de la rotation à partir de cette date.">
          <div className="mb-3">
            <label className="form-label" htmlFor="changed_on">
              Changé le
            </label>
            <input type="date" name="changed_on" id="changed_on" className="form-control" defaultValue={today} max={today} />
          </div>
          <div>
            <label className="form-label" htmlFor="mdp_comment">
              Commentaire <span className="text-muted">(optionnel)</span>
            </label>
            <input type="text" name="comment" id="mdp_comment" className="form-control" placeholder="ex : rotation planifiée" />
          </div>
        </ModalAction>
      ) : null}
    </>
  );
}
