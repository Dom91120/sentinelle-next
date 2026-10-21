import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Documents } from "@/components/documents";
import {
  Activite,
  BandeauEcheance,
  BoutonModal,
  CarteEditeur,
  Champ,
  Entete,
  Historique,
  Lie,
  Lien,
  ModalAction,
  TitreSection,
} from "@/components/fiche";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import { QaModalSupplier } from "@/components/quick-add";
import { EQUIPMENT_KIND_ICONS } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import {
  contractActionDeadline,
  contractKindLabel,
  contractRenewalLabel,
  contractStatus,
} from "@/lib/statuts";
import { FormulaireContrat } from "@/modules/contracts/form-page";
import { couvertsDe, formContext, natureLabel } from "@/modules/contracts/server";
import { Synthese } from "@/modules/contracts/vues";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { documentsEnabled, forParent } from "@/server/documents";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";
import { getActiveSnooze } from "@/server/snooze";

/** contracts/detail.html */
/** Le titre de l'onglet, comme le `{% block title %}` du gabarit Jinja. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idDeRoute((await params).id);
  const fiche = await prisma.contract.findUnique({ where: { id }, select: { name: true } });
  return { title: fiche ? `${fiche.name} - Sentinelle` : "Sentinelle" };
}

export default async function ContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("contracts");
  const id = idDeRoute((await params).id);
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      kindRef: true,
      supplier: true,
      software: { include: { software: true } },
      equipments: { include: { equipment: true } },
    },
  });
  if (!contract) notFound();
  const { user, csrf } = page;
  const peutEditer = user.canEdit("contracts");
  const docsOn = documentsEnabled(user.settings);
  const legacy = user.settings.CONTRACT_FORM_LEGACY;
  const [histories, voisins, ctx, couverts, snooze, pieces] = await Promise.all([
    prisma.contractHistory.findMany({
      where: { contractId: id },
      orderBy: { performedAt: "desc" },
    }),
    voisinsDe("contract", id, "name", page),
    peutEditer ? formContext() : Promise.resolve(null),
    couvertsDe(id),
    getActiveSnooze("contract", id),
    docsOn ? forParent("contract", id) : Promise.resolve([]),
  ]);
  const statut = contractStatus(contract, seuilsDe(user.settings));
  const nature = natureLabel(contract);
  // Fournisseur et référence seulement : le type et la nature se lisent dans la synthèse.
  const sousTitre = [contract.supplier?.name, contract.reference].filter(Boolean).join(" · ");
  const complement = `${contract.endDate ? `échéance ${dateCourte(contract.endDate)}` : ""}${contract.noticeDays ? ` · préavis de ${contract.noticeDays} j` : ""}${contract.autoRenew ? " · reconduction tacite" : ""}`;
  const logiciels = contract.software.map((l) => l.software);
  const equipements = contract.equipments.map((l) => l.equipment);
  return (
    <>
      <Entete
        titre={contract.name}
        sousTitre={sousTitre}
        statut={statut}
        primaire={
          peutEditer ? (
            <BoutonModal id="renouveler" libelle="Marquer renouvelé" icone="bi-arrow-repeat" />
          ) : null
        }
        voisins={voisins}
        base="/contracts"
        bandeau={
          <BandeauEcheance
            libelle="Agir avant"
            date={contractActionDeadline(contract)}
            statut={statut}
            passe="préavis dépassé"
            debut={contract.startDate}
            complement={complement}
            sansDate="échéance à renseigner"
          />
        }
      />

      <BarreOnglets
        id="ficheContract"
        modifier={peutEditer ? `/contracts/${id}/edit` : null}
        surPlace
      >
        <Onglet cible="detail" libelle="Synthèse" icone="bi-card-text" actif />
        {peutEditer ? <Onglet cible="details" libelle="Détails" icone="bi-pencil-square" /> : null}
        {docsOn ? (
          <Onglet
            cible="documents"
            libelle="Pièces"
            icone="bi-paperclip"
            compteur={pieces.length}
          />
        ) : null}
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
              {!legacy ? (
                <Synthese contract={contract} />
              ) : (
                <div className="data-card p-3 mb-3">
                  <div className="fiche-sections">
                    <div className="fiche-bloc">
                      <TitreSection
                        titre="L'acte"
                        icone="bi-file-earmark-text"
                        couleur="slate"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ label="Nature" value={nature} />
                        <Champ label="Type" value={contractKindLabel(contract)} />
                        <Champ label="Notre référence" value={contract.reference} />
                        <Champ label="Référence fournisseur" value={contract.supplierReference} />
                      </div>
                    </div>
                    <div className="fiche-bloc">
                      <TitreSection
                        titre="Montants"
                        icone="bi-cash-coin"
                        couleur="slate"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ
                          label="Montant annuel"
                          value={
                            <>
                              {contract.costYearly ? `${contract.costYearly.toFixed(0)} €` : ""}
                              {contract.costMaxYearly ? (
                                <small className="d-block text-muted">
                                  maximum annuel : {contract.costMaxYearly.toFixed(0)} €
                                </small>
                              ) : null}
                              {contract.costTotal ? (
                                <small className="d-block text-muted">
                                  total sur la durée : {contract.costTotal.toFixed(0)} €
                                </small>
                              ) : null}
                            </>
                          }
                        />
                        <Champ label="Imputation budgétaire" value={contract.budgetCode} />
                      </div>
                    </div>
                    <div className="fiche-bloc">
                      <TitreSection
                        titre="Durée"
                        icone="bi-calendar-range"
                        couleur="slate"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ
                          label="Début"
                          value={contract.startDate ? dateCourte(contract.startDate) : null}
                        />
                        <Champ
                          label="Échéance"
                          value={contract.endDate ? dateCourte(contract.endDate) : null}
                        />
                        <Champ
                          label="Préavis de résiliation"
                          value={contract.noticeDays ? `${contract.noticeDays} jours` : null}
                        />
                        <Champ
                          label="Durée ferme"
                          value={
                            <>
                              {contract.firmYears
                                ? `${contract.firmYears} an${contract.firmYears > 1 ? "s" : ""}`
                                : ""}
                              {contractRenewalLabel(contract) ? (
                                <small className="d-block text-muted">
                                  {contractRenewalLabel(contract)}
                                </small>
                              ) : null}
                            </>
                          }
                        />
                        <Champ label="Reconduction" value={contract.autoRenew ? "Tacite" : "Non"} />
                      </div>
                    </div>
                    <div className="fiche-bloc">
                      <TitreSection
                        titre="Suivi"
                        icone="bi-person-check"
                        couleur="slate"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ
                          label="Bon de commande signé le"
                          value={contract.orderSignedOn ? dateCourte(contract.orderSignedOn) : null}
                        />
                      </div>
                    </div>
                    <div className="fiche-bloc">
                      <TitreSection
                        titre="Notes"
                        icone="bi-journal-text"
                        couleur="slate"
                        classes="mb-0"
                      />
                      <div className="fiche-grille">
                        <Champ label="Description" value={contract.description ?? ""} large />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="col-lg-3">
              <CarteEditeur sup={contract.supplier} />
              {legacy ? (
                <Lie titre="Couvre">
                  {logiciels.map((sw) => (
                    <Lien
                      key={`s${sw.id}`}
                      url={`/inventory/logiciels/${sw.id}`}
                      icone="app-window"
                      nom={sw.name}
                      teinte="software"
                    />
                  ))}
                  {equipements.map((e) => (
                    <Lien
                      key={`e${e.id}`}
                      url={`/inventory/${e.id}`}
                      icone={EQUIPMENT_KIND_ICONS[e.kind ?? "vm"] ?? "server"}
                      nom={e.name}
                      teinte={e.kind}
                    />
                  ))}
                </Lie>
              ) : null}
              <Activite histories={histories} />
              <SnoozeCard
                entityType="contract"
                entityId={id}
                user={user}
                snooze={snooze}
                csrf={csrf}
              />
            </div>
          </div>
        </Volet>

        {peutEditer && ctx ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormulaireContrat
                contract={contract}
                ctx={ctx}
                couverts={couverts}
                page={page}
                retour={`/contracts/${id}#details`}
                actionForm={`/contracts/${id}/edit`}
                dansFiche
              />
            </fieldset>
          </Volet>
        ) : null}

        {docsOn ? (
          <Volet cible="documents">
            <Documents
              parentKind="contract"
              parentId={id}
              permission="contracts"
              user={user}
              csrf={csrf}
            />
          </Volet>
        ) : null}

        <Volet cible="historique">
          <Historique histories={histories} />
        </Volet>
      </Volets>

      {peutEditer ? (
        <>
          <ModalAction
            id="renouveler"
            titre="Marquer le contrat renouvelé"
            action={`/contracts/${id}/renew`}
            csrf={csrf}
            bouton="Marquer renouvelé"
            icone="bi-arrow-repeat"
            aide="Enregistre la nouvelle échéance ; la précédente reste dans l'historique."
          >
            <div className="mb-3">
              <label className="form-label" htmlFor="new_end_date">
                Nouvelle échéance <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                name="new_end_date"
                id="new_end_date"
                className="form-control"
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="renew_comment">
                Commentaire <span className="text-muted">(optionnel)</span>
              </label>
              <input
                type="text"
                name="comment"
                id="renew_comment"
                className="form-control"
                placeholder="ex : avenant n° 2 signé"
              />
            </div>
          </ModalAction>
          {user.canEdit("suppliers") ? <QaModalSupplier csrf={csrf} /> : null}
        </>
      ) : null}
    </>
  );
}
