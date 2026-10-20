import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CarteFournisseur, Entete, Fait, FaitBloc, Faits, TitreSection } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { BACKUP_FREQ_LABEL } from "@/lib/constantes";
import { dateCourte } from "@/lib/libelles";
import {
  accountStatus,
  backupComputedStatus,
  certificateStatus,
  contractStatus,
  softwareComputedStatus,
  softwareIsSaas,
  updateStatusColor,
} from "@/lib/statuts";
import { formContext } from "@/modules/inventory/server";
import { envLabel, FormCorps, kindLabel, Synthese } from "@/modules/inventory/vues";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { chargerEquipements } from "@/server/donnees";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";

/** inventory/detail.html */
/** Le titre de l'onglet, comme le `{% block title %}` du gabarit Jinja. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = idDeRoute((await params).id);
  const fiche = await prisma.equipment.findUnique({ where: { id }, select: { name: true } });
  return { title: fiche ? `${fiche.name} - Inventaire` : "Inventaire" };
}

export default async function InventoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("inventory");
  const id = idDeRoute((await params).id);
  const brut = await prisma.equipment.findUnique({
    where: { id },
    include: {
      supplier: true,
      softwareList: { include: { software: { include: { systemUpdates: true } } } },
      certificates: { where: { isActive: true }, orderBy: { expiryDate: "asc" } },
      backups: {
        where: { isActive: true },
        orderBy: { serviceName: "asc" },
        include: { checks: { orderBy: { checkDate: "desc" } } },
      },
      systemUpdates: { where: { isActive: true }, orderBy: { name: "asc" } },
      contracts: { include: { contract: { include: { kindRef: true } } } },
      accounts: {
        where: { isActive: true },
        orderBy: [{ serviceName: "asc" }, { username: "asc" }],
      },
    },
  });
  if (!brut) notFound();
  const { user, csrf, nonce } = page;
  const peutEditer = user.canEdit("inventory");
  const seuils = seuilsDe(user.settings);
  const [statuts, voisins, ctx] = await Promise.all([
    chargerEquipements(),
    voisinsDe("equipment", id, "name", page),
    formContext(brut),
  ]);
  const calc = statuts.find((e) => e.id === id);
  const statut = calc?.status ?? "success";
  const reasons = calc?.reasons ?? [];
  const item = brut;
  const contrats = item.contracts
    .map((c) => c.contract)
    .filter((c) => c.isActive)
    .sort(
      (a, b) =>
        (a.endDate?.getTime() ?? Number.POSITIVE_INFINITY) -
        (b.endDate?.getTime() ?? Number.POSITIVE_INFINITY),
    );
  const installes = item.softwareList.map((l) => l.software).filter((s) => s.isActive);
  // Sans l'adresse IP : le bandeau de faits la porte déjà, juste à côté.
  const sousTitre = `${kindLabel(item)}${item.environment ? ` · ${envLabel(item)}` : ""}${item.criticality ? ` · criticité ${item.criticality}` : ""}`;
  const porteReseau = ["vm", "physical", "nas", "storage", "network"].includes(item.kind);
  const showCerts = user.canView("certificates") && item.certificates.length > 0;
  const showBkps = user.canView("backups") && item.backups.length > 0;
  const showUpds = user.canView("updates") && item.systemUpdates.length > 0;
  const showCtrs = user.canView("contracts") && contrats.length > 0;
  const showAccts = user.canView("accounts") && item.accounts.length > 0;
  return (
    <>
      <Entete
        titre={item.name}
        sousTitre={sousTitre}
        statut={statut}
        voisins={voisins}
        base="/inventory"
        bandeau={
          <div className={`data-card fiche-bandeau fiche-bandeau--${statut}`}>
            <Faits>
              <Fait
                label="OS"
                value={`${item.os ?? ""}${item.osVersion ? ` ${item.osVersion}` : ""}`.trim()}
              />
              {porteReseau ? <Fait label="Adresse IP" value={item.ipAddress} /> : null}
              <FaitBloc label="Sauvegarde">
                {item.backup1 ? item.backup1 : <small className="text-danger">aucune</small>}
              </FaitBloc>
            </Faits>
          </div>
        }
      />

      <BarreOnglets id="ficheItem" modifier={peutEditer ? `/inventory/${id}/edit` : null} surPlace>
        <Onglet cible="detail" libelle="Synthèse" icone="bi-card-text" actif />
        {peutEditer ? <Onglet cible="details" libelle="Détails" icone="bi-pencil-square" /> : null}
        <Onglet cible="elements" libelle="Éléments liés" icone="bi-diagram-3" />
        <Onglet cible="logiciels" libelle="Logiciels installés" icone="bi-window-stack" />
      </BarreOnglets>

      <Volets>
        <Volet cible="detail" actif>
          <div className="row g-3">
            <div className={item.supplier ? "col-lg-9" : "col-12"}>
              {reasons.length ? (
                <div className="alert alert-warning py-2 small mb-3">
                  <Icone bi="bi-exclamation-triangle" taille="1em" classes="me-1" />
                  {reasons.join(" · ")}
                </div>
              ) : null}
              <Synthese item={item} />
            </div>
            {item.supplier ? (
              <div className="col-lg-3">
                <CarteFournisseur sup={item.supplier} titre="Support / fournisseur" />
              </div>
            ) : null}
          </div>
        </Volet>

        {peutEditer ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormCorps
                item={item}
                {...ctx}
                user={user}
                csrf={csrf}
                nonce={nonce}
                retour={`/inventory/${id}#details`}
                actionForm={`/inventory/${id}/edit`}
              />
            </fieldset>
          </Volet>
        ) : null}

        <Volet cible="elements">
          {showCerts || showBkps || showUpds || showCtrs || showAccts ? (
            <div className="data-card p-4 mb-3">
              <TitreSection
                titre="Éléments liés"
                icone="bi-diagram-3"
                couleur="slate"
                classes="mb-3"
              />
              {showCerts ? (
                <>
                  <small className="text-muted d-block mb-1">Certificats</small>
                  <ul className="list-unstyled mb-2">
                    {item.certificates.map((c) => (
                      <li className="mb-1" key={c.id}>
                        <span
                          className={`badge-status badge-${certificateStatus(c, seuils)} me-1`}
                        />
                        <a href={`/certificates/${c.id}`}>
                          {c.serviceName} — {c.domain}
                        </a>{" "}
                        <small className="text-muted">
                          exp. {c.expiryDate ? dateCourte(c.expiryDate) : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {showBkps ? (
                <>
                  <small className="text-muted d-block mb-1">Sauvegardes</small>
                  <ul className="list-unstyled mb-2">
                    {item.backups.map((b) => (
                      <li className="mb-1" key={b.id}>
                        <span
                          className={`badge-status badge-${backupComputedStatus(b, b.checks)} me-1`}
                        />
                        <a href={`/backups/${b.id}`}>{b.serviceName}</a>{" "}
                        <small className="text-muted">
                          {(
                            BACKUP_FREQ_LABEL[b.frequency ?? ""] ??
                            b.frequency ??
                            "Non definie"
                          ).toLowerCase()}
                        </small>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {showUpds ? (
                <>
                  <small className="text-muted d-block mb-1">Mises à jour</small>
                  <ul className={`list-unstyled ${showCtrs ? "mb-2" : "mb-0"}`}>
                    {item.systemUpdates.map((u) => (
                      <li className="mb-1" key={u.id}>
                        <span className={`badge-status badge-${updateStatusColor(u)} me-1`} />
                        <a href={`/updates/${u.id}`}>{u.name}</a>{" "}
                        {u.currentVersion ? (
                          <small className="text-muted">v{u.currentVersion}</small>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {showCtrs ? (
                <>
                  <small className="text-muted d-block mb-1">Contrats</small>
                  <ul className={`list-unstyled ${showAccts ? "mb-2" : "mb-0"}`}>
                    {contrats.map((c) => (
                      <li className="mb-1" key={c.id}>
                        <span className={`badge-status badge-${contractStatus(c, seuils)} me-1`} />
                        <a href={`/contracts/${c.id}`}>{c.name}</a>{" "}
                        {c.endDate ? (
                          <small className="text-muted">éch. {dateCourte(c.endDate)}</small>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {showAccts ? (
                <>
                  <small className="text-muted d-block mb-1">Comptes</small>
                  <ul className="list-unstyled mb-0">
                    {item.accounts.map((a) => (
                      <li className="mb-1" key={a.id}>
                        <span className={`badge-status badge-${accountStatus(a, seuils)} me-1`} />
                        <a href={`/accounts/${a.id}`}>
                          {a.serviceName} ({a.username})
                        </a>{" "}
                        {a.nextPasswordChange ? (
                          <small className="text-muted">
                            mdp avant le {dateCourte(a.nextPasswordChange)}
                          </small>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </Volet>

        <Volet cible="logiciels">
          {installes.length ? (
            <div className="data-card p-4 mb-3">
              <TitreSection
                titre="Logiciels installés"
                icone="bi-window-stack"
                couleur="violet"
                classes="mb-3"
              />
              <ul className="list-unstyled mb-0">
                {installes.map((s) => (
                  <li className="mb-1" key={s.id}>
                    <span
                      className={`badge-status badge-${softwareComputedStatus(s, s.systemUpdates)} me-1`}
                    />
                    <a href={`/inventory/logiciels/${s.id}`}>{s.name}</a>{" "}
                    {s.version ? <small className="text-muted">v{s.version}</small> : null}
                    {softwareIsSaas(s) ? <small className="text-muted"> (SaaS)</small> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Volet>
      </Volets>
    </>
  );
}
