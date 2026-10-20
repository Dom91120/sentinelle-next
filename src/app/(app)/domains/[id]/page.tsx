import { notFound } from "next/navigation";
import { Activite, BandeauEcheance, Entete, Historique, MenuLien, MenuPost } from "@/components/fiche";
import { Icone } from "@/components/icones";
import { StatusBadge } from "@/components/macros";
import { BarreOnglets, Onglet, Volet, Volets } from "@/components/onglets";
import { SnoozeCard } from "@/components/partials";
import { dateCourte } from "@/lib/libelles";
import { certificateStatus, domainStatus } from "@/lib/statuts";
import { formContext, sans } from "@/modules/domains/server";
import { FormCorps, Synthese } from "@/modules/domains/vues";
import { seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { idDeRoute } from "@/server/guards";
import { contexteModule, voisinsDe } from "@/server/module";
import { getActiveSnooze } from "@/server/snooze";

/** domains/detail.html */
export default async function DomainDetail({ params }: { params: Promise<{ id: string }> }) {
  const page = await contexteModule("domains");
  const id = idDeRoute((await params).id);
  const domain = await prisma.domain.findUnique({ where: { id }, include: { registrarSupplier: true } });
  if (!domain) notFound();
  const { user, csrf, nonce } = page;
  const peutEditer = user.canEdit("domains");
  const seuils = seuilsDe(user.settings);
  const [histories, ctBruts, ctNew, certsBruts, voisins, ctx, snooze] = await Promise.all([
    prisma.domainHistory.findMany({ where: { domainId: id }, orderBy: { performedAt: "desc" } }),
    prisma.ctLogEntry.findMany({ where: { domainId: id }, orderBy: { crtshId: "desc" }, take: 50 }),
    prisma.ctLogEntry.count({ where: { domainId: id, status: "new" } }),
    prisma.certificate.findMany({ where: { domainId: id, isActive: true } }),
    voisinsDe("domain", id, "name", page),
    peutEditer ? formContext() : Promise.resolve({ suppliers: [] }),
    getActiveSnooze("domain", id),
  ]);
  // Les nouveaux d'abord, puis les plus récents.
  const ctEntries = [...ctBruts].sort((a, b) => Number(a.status !== "new") - Number(b.status !== "new") || Number(b.crtshId ?? 0) - Number(a.crtshId ?? 0));
  const certificats = [...certsBruts].sort((a, b) => Number(a.expiryDate === null) - Number(b.expiryDate === null) || (a.expiryDate?.getTime() ?? 0) - (b.expiryDate?.getTime() ?? 0));
  const statut = domainStatus(domain, seuils);
  const sousTitre = `Nom de domaine${domain.registrar ? ` · registrar ${domain.registrar}` : ""} · renouvellement ${domain.autoRenew ? "automatique" : "manuel"}`;
  const complement = domain.autoRenew && domain.registrar ? `renouv. automatique chez ${domain.registrar}` : domain.autoRenew ? "renouv. automatique" : "renouv. manuel";
  const pluriel = ctNew > 1;
  const menu = [
    <MenuLien key="pdf" url={`/domains/${id}/pdf`} libelle="Exporter en PDF" icone="bi-file-earmark-pdf" />,
    peutEditer ? <MenuPost key="ct" url={`/domains/${id}/scan-ct`} libelle="Scanner les journaux CT (crt.sh)" icone="bi-search" csrf={csrf} /> : null,
    peutEditer && ctNew ? <MenuPost key="ack" url={`/domains/${id}/ct-ack`} libelle={`Marquer les ${ctNew} nouveaux certificats comme vérifiés`} icone="bi-check2-all" csrf={csrf} /> : null,
  ];
  return (
    <>
      <title>{`${domain.name} - Sentinelle`}</title>
      <Entete
        titre={domain.name}
        sousTitre={sousTitre}
        statut={statut}
        primaire={
          peutEditer ? (
            <form method="POST" action={`/domains/${id}/check-rdap`} className="d-inline">
              <input type="hidden" name="csrf_token" value={csrf} />
              <button type="submit" className="btn btn-primary" title="Interroge le registre (RDAP) et met à jour la date d'expiration et le registrar">
                <Icone bi="bi-arrow-repeat" taille="1em" classes="me-1" /> Vérifier au registre
              </button>
            </form>
          ) : null
        }
        menu={menu}
        voisins={voisins}
        base="/domains"
        bandeau={<BandeauEcheance libelle="Expiration" date={domain.expiryDate} statut={statut} passe="expiré depuis" debut={domain.renewedOn} complement={complement} sansDate="date d'expiration à renseigner (ou lancez la vérification au registre)" />}
      />

      <BarreOnglets id="ficheDomain" modifier={peutEditer ? `/domains/${id}/edit` : null} surPlace>
        <Onglet cible="detail" libelle="Synthèse" icone="bi-card-text" actif />
        {peutEditer ? <Onglet cible="details" libelle="Détails" icone="bi-pencil-square" /> : null}
        {user.canView("certificates") ? <Onglet cible="certificats" libelle="Certificats" icone="bi-award" compteur={certificats.length} /> : null}
        <Onglet cible="certificate-transparency" libelle="Certificate Transparency" icone="bi-search" compteur={ctEntries.length} />
        <Onglet cible="historique" libelle="Historique" icone="bi-clock-history" compteur={histories.length} />
      </BarreOnglets>

      <Volets>
        <Volet cible="detail" actif>
          <div className="row g-3">
            <div className="col-lg-9">
              {ctNew ? (
                <div className="alert alert-warning py-2 small mb-3">
                  <Icone bi="bi-shield-exclamation" taille="1em" classes="me-1" />
                  <strong>
                    {ctNew} nouveau{pluriel ? "x" : ""} certificat{pluriel ? "s" : ""}
                  </strong>{" "}
                  observé{pluriel ? "s" : ""} dans les journaux Certificate Transparency : à vérifier dans l'onglet dédié.
                </div>
              ) : null}
              <Synthese domain={domain} />
            </div>
            <div className="col-lg-3">
              <Activite histories={histories} />
              <SnoozeCard entityType="domain" entityId={id} user={user} snooze={snooze} csrf={csrf} />
            </div>
          </div>
        </Volet>

        {peutEditer ? (
          <Volet cible="details">
            <fieldset className="edition-verrou" data-edition-verrou disabled>
              <FormCorps domain={domain} {...ctx} user={user} csrf={csrf} nonce={nonce} retour={`/domains/${id}#details`} actionForm={`/domains/${id}/edit`} />
            </fieldset>
          </Volet>
        ) : null}

        {user.canView("certificates") ? (
          <Volet cible="certificats">
            <div className="data-card mb-3">
              <div className="card-header-custom">
                <h6 className="fw-bold mb-0">
                  <Icone bi="bi-award" taille="1em" classes="me-2" />
                  Certificats TLS de ce domaine <span className="badge bg-secondary ms-1">{certificats.length}</span>
                </h6>
                <small className="text-muted">Les certificats suivis dont le nom d'hôte relève de ce domaine</small>
              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Nom d'hôte</th>
                      <th>Émetteur</th>
                      <th className="text-nowrap">Expire le</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificats.length ? (
                      certificats.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <a href={`/certificates/${c.id}`} className="text-decoration-none fw-medium">
                              {c.serviceName}
                            </a>
                          </td>
                          <td className="small">
                            <code>{c.domain}</code>
                          </td>
                          <td className="small">{c.issuer || "—"}</td>
                          <td className="text-nowrap small">{c.expiryDate ? dateCourte(c.expiryDate) : "—"}</td>
                          <td>
                            <StatusBadge status={certificateStatus(c, seuils)} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-3 text-muted">
                          Aucun certificat suivi pour ce domaine.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Volet>
        ) : null}

        <Volet cible="certificate-transparency">
          <div className="data-card mb-3">
            <div className="card-header-custom">
              <h6 className="fw-bold mb-0">
                <Icone bi="bi-shield-lock" taille="1em" classes="me-2" />
                Certificate Transparency {ctNew ? <span className="badge-status badge-warning ms-1">{`${ctNew} nouveau${pluriel ? "x" : ""}`}</span> : null}
              </h6>
              <small className="text-muted">Certificats émis pour ce domaine, d'après crt.sh — y compris ceux inconnus de la DSI</small>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Statut</th>
                    <th>Nom(s)</th>
                    <th>Émetteur</th>
                    <th className="text-nowrap">Émis le</th>
                  </tr>
                </thead>
                <tbody>
                  {ctEntries.length ? (
                    ctEntries.map((e) => {
                      const noms = sans(e);
                      return (
                        <tr key={e.id} className={e.status === "new" ? "row-warning" : undefined}>
                          <td>
                            {e.status === "new" ? (
                              <span className="badge-status badge-warning">Nouveau</span>
                            ) : e.status === "acknowledged" ? (
                              <span className="badge-status badge-success">Vérifié</span>
                            ) : e.status === "baseline" ? (
                              <span className="badge-status badge-muted">Base</span>
                            ) : (
                              <span className="badge-status badge-muted">{e.status}</span>
                            )}
                          </td>
                          <td className="small">
                            {noms.slice(0, 3).join(", ")}
                            {noms.length > 3 ? <span className="text-muted"> (+{noms.length - 3})</span> : null}
                          </td>
                          <td className="small">{e.issuerName || "—"}</td>
                          <td className="text-nowrap small">{e.notBefore ? dateCourte(e.notBefore) : "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-3 text-muted">
                        Aucun certificat observé. Lancez un scan (menu ⋯) pour établir la ligne de base.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Volet>

        <Volet cible="historique">
          <Historique histories={histories} />
        </Volet>
      </Volets>
    </>
  );
}
