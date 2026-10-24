/** Les onglets Contrats et Devis d'un logiciel (port de software/_contrats.html et _consultations.html). */

import { Icone, Lucide } from "@/components/icones";
import { StatusBadge } from "@/components/macros";
import type {
  Consultation,
  Contract,
  Quote,
  Referential,
  Software,
  Supplier,
} from "@/generated/prisma/client";
import { CONTRACT_NATURE_LABELS } from "@/lib/constantes";
import { dateCourte, montant, tailleLabel } from "@/lib/libelles";
import { couleurIcone } from "@/lib/navigation";
import type { Seuils } from "@/lib/statuts";
import {
  contractActionDeadline,
  contractDaysLeft,
  contractKindLabel,
  contractPeriodLabel,
  contractRenewalLabel,
  contractStatus,
} from "@/lib/statuts";
import { type DocumentAvecCategorie, hasFile, viewable } from "@/server/documents";
import type { CurrentUser } from "@/server/guards";

export type MarcheComplet = Contract & { kindRef: Referential | null; supplier: Supplier | null };
export type ConsultationComplete = Consultation & {
  quotes: (Quote & { supplier: Supplier | null })[];
};

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function DocumentEditMarche({
  d,
  categories,
  csrf,
  next,
}: {
  d: DocumentAvecCategorie;
  categories: Referential[];
  csrf: string;
  next: string;
}) {
  const titre = hasFile(d) ? "Remplacer le fichier" : "Déposer le fichier";
  return (
    <div className="collapse doc-edit-volet" id={`docEdit${d.id}`}>
      <form
        method="POST"
        action={`/documents/${d.id}/edit`}
        encType="multipart/form-data"
        className="doc-edit p-2 rounded border bg-body-tertiary"
      >
        <input type="hidden" name="csrf_token" value={csrf} />
        <input type="hidden" name="next" value={next} />
        <div className="row g-2 align-items-start">
          <div className="col">
            <label className="form-label fw-medium small mb-1" htmlFor={`docNom${d.id}`}>
              Nom du fichier
            </label>
            <input
              type="text"
              name="filename"
              id={`docNom${d.id}`}
              className="form-control form-control-sm"
              defaultValue={d.filename}
              maxLength={180}
              required
            />
            <div className="form-text doc-aide">Renomme le fichier déposé</div>
          </div>
          <div className="col-auto">
            <label className="form-label small mb-1 d-block">&nbsp;</label>
            <input
              type="file"
              name="file"
              id={`docFichier${d.id}`}
              className="d-none"
              data-fichier-bouton
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary btn-icone"
              data-titre={titre}
              title={titre}
              aria-label={titre}
              data-click-prev
            >
              <Lucide nom="upload" taille={16} />
            </button>
          </div>
          <div className="col-auto">
            <label className="form-label fw-medium small mb-1">Catégorie</label>
            <select
              name="category_id"
              className="form-select form-select-sm"
              defaultValue={d.categoryId ?? ""}
            >
              <option value="">— Non classée —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label fw-medium small mb-1">Date de l'acte</label>
            <input
              type="date"
              name="doc_date"
              className="form-control form-control-sm"
              defaultValue={d.docDate ? d.docDate.toISOString().slice(0, 10) : ""}
            />
          </div>
          <div className="col-auto d-flex gap-1">
            <div>
              <label className="form-label small mb-1 d-block">&nbsp;</label>
              <button
                type="submit"
                className="btn btn-sm btn-ghost btn-icone btn-valider"
                title="Enregistrer"
                aria-label="Enregistrer"
              >
                <Lucide nom="check" taille={16} />
              </button>
            </div>
            <div>
              <label className="form-label small mb-1 d-block">&nbsp;</label>
              <button
                type="button"
                className="btn btn-sm btn-ghost btn-icone btn-annuler"
                title="Annuler"
                aria-label="Annuler"
                data-bs-toggle="collapse"
                data-bs-target={`#docEdit${d.id}`}
              >
                <Lucide nom="x" taille={16} />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export type ContratsProps = {
  item: Software;
  marches: MarcheComplet[];
  rattachables: MarcheComplet[];
  docsParMarche: Map<number, DocumentAvecCategorie[]>;
  docCategories: Referential[];
  documentsEnabled: boolean;
  seuils: Seuils;
  user: CurrentUser;
  csrf: string;
};

/** software/_contrats.html */
export function Contrats({
  item,
  marches,
  rattachables,
  docsParMarche,
  docCategories,
  documentsEnabled,
  seuils,
  user,
  csrf,
}: ContratsProps) {
  const peutEditer = user.canEdit("contracts");
  const peutModifierDoc = user.canEdit("contracts");
  const peutRetirerDoc = user.canDelete("contracts");
  const retourIci = `/inventory/logiciels/${item.id}#contrats`;
  const cfg = user.settings;
  const n = rattachables.length;
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom d-flex justify-content-between align-items-center gap-2 flex-wrap">
        <h6 className="fw-bold fiche-titre fiche-titre--amber mb-0">
          <Icone
            bi="bi-file-earmark-text"
            taille={14}
            classes={`ico ico-${couleurIcone("bi-file-earmark-text")}`}
          />
          Contrats <span className="badge bg-secondary ms-1">{marches.length}</span>
        </h6>
        {peutEditer ? (
          <div className="d-flex gap-2 marches-actions">
            {n ? (
              <form
                method="POST"
                action={`/contracts/software/${item.id}/attach`}
                className="d-flex gap-2"
              >
                <input type="hidden" name="csrf_token" value={csrf} />
                <select
                  name="contract_id"
                  className="form-select form-select-sm"
                  style={{ maxWidth: "20rem" }}
                  required
                  aria-label="Rattacher un marché existant"
                  defaultValue=""
                >
                  <option value="">— Rattacher un marché existant —</option>
                  {rattachables.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.reference ? `${c.reference} — ` : ""}
                      {c.name}
                      {c.supplier ? ` (${c.supplier.name})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="btn btn-sm btn-ghost btn-icone"
                  title="Rattacher le marché choisi"
                  aria-label="Rattacher le marché choisi"
                >
                  <Lucide nom="link" taille={16} />
                </button>
              </form>
            ) : null}
            <a
              href={`/contracts/create?software_id=${item.id}`}
              className="btn btn-sm btn-ghost btn-icone"
              title="Créer un marché"
              aria-label="Créer un marché"
              data-formulaire-inline
              data-avant="#marches-liste"
              data-classes="p-3 border-bottom"
            >
              <Lucide nom="plus" taille={16} />
            </a>
          </div>
        ) : null}
      </div>

      <div id="marches-liste">
        {marches.length ? (
          marches.map((c, i) => {
            const nature = CONTRACT_NATURE_LABELS[c.nature ?? ""] || contractKindLabel(c);
            const haut = c.reference || nature;
            const jours = contractDaysLeft(c);
            const deadline = contractActionDeadline(c);
            const periode = contractPeriodLabel(c);
            const detail = `${CONTRACT_NATURE_LABELS[c.nature ?? ""] ? `${contractKindLabel(c)}${periode ? " · " : ""}` : ""}${capitalize(periode)}${jours !== null && deadline ? ` · agir avant le ${dateCourte(deadline)} (${jours} j)` : ""}${c.autoRenew ? " · tacite reconduction" : contractRenewalLabel(c) ? ` · ${contractRenewalLabel(c)}` : ""}${c.supplierReference ? ` · réf. fournisseur ${c.supplierReference}` : ""}`;
            const docs = documentsEnabled ? (docsParMarche.get(c.id) ?? []) : [];
            return (
              <div
                className={`p-3 ${i === marches.length - 1 ? "" : "border-bottom"}`}
                id={`marche-${c.id}`}
                key={c.id}
              >
                <div
                  className="d-flex justify-content-between align-items-center gap-3"
                  id={`marche-${c.id}-entete`}
                >
                  <div className="flex-grow-1 marche-entete">
                    <div>
                      {haut ? (
                        <a
                          href={`/contracts/${c.id}`}
                          className="d-block fw-semibold text-decoration-none marche-tronque"
                          title={haut}
                        >
                          {haut}
                        </a>
                      ) : null}
                      {c.reference && nature ? (
                        <span className="d-block marche-sous marche-tronque" title={nature}>
                          {nature}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <span className="d-flex align-items-baseline gap-2 min-w-0 fw-semibold">
                        <a
                          href={`/contracts/${c.id}`}
                          className="text-decoration-none marche-tronque"
                          title={c.name}
                        >
                          {c.name}
                        </a>
                        <StatusBadge status={contractStatus(c, seuils)} />
                      </span>
                      <span className="d-block marche-sous marche-tronque" title={detail}>
                        {detail}
                      </span>
                    </div>
                    <div className="marche-droite">
                      <span className="d-block fw-semibold marche-tronque">
                        {c.supplier ? (
                          <a
                            href={`/suppliers/${c.supplierId}`}
                            className="text-decoration-none"
                            title={c.supplier.name}
                          >
                            {c.supplier.name}
                          </a>
                        ) : null}
                      </span>
                      <span className="d-block marche-sous marche-tronque">
                        {c.costYearly ? `Mnt annuel : ${montant(c.costYearly)}` : ""}
                        {c.costMaxYearly
                          ? `${c.costYearly ? " · " : ""}Maxi : ${montant(c.costMaxYearly)}`
                          : ""}
                        {c.costTotal && !c.costYearly ? `Total : ${montant(c.costTotal)}` : ""}
                      </span>
                    </div>
                  </div>
                  {peutEditer ? (
                    <div className="d-flex gap-1 flex-shrink-0">
                      <a
                        href={`/contracts/${c.id}/edit`}
                        className="btn btn-sm btn-ghost btn-icone"
                        data-formulaire-inline
                        data-cible={`#marche-${c.id}-entete`}
                        data-classes="p-3 rounded-3 mb-3"
                        title="Modifier le contrat"
                        aria-label="Modifier le contrat"
                      >
                        <Lucide nom="pencil" taille={16} />
                      </a>
                      <form method="POST" action={`/contracts/${c.id}/software/${item.id}/detach`}>
                        <input type="hidden" name="csrf_token" value={csrf} />
                        <button
                          type="submit"
                          className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                          title="Retirer ce marché du logiciel (le marché n'est pas supprimé)"
                          aria-label="Retirer ce marché du logiciel"
                          data-confirm={`Retirer « ${c.name} » de ce logiciel ? Le marché n'est pas supprimé.`}
                        >
                          <Lucide nom="unlink" taille={16} />
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>

                <div className="marche-docs-zone">
                  {documentsEnabled && (docs.length || peutModifierDoc) ? (
                    <div className="marche-docs-entete d-flex align-items-end justify-content-between gap-3 mb-2 pb-1">
                      <span className="marche-docs-titre">
                        {docs.length} Document{docs.length > 1 ? "s" : ""}
                      </span>
                      {peutModifierDoc ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-icone"
                          data-bs-toggle="collapse"
                          data-bs-target={`#docDepot${c.id}`}
                          title="Ajouter une pièce"
                          aria-label="Ajouter une pièce"
                        >
                          <Lucide nom="plus" taille={16} />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {documentsEnabled && peutModifierDoc ? (
                    <div className="collapse" id={`docDepot${c.id}`}>
                      <form
                        method="POST"
                        action="/documents/upload"
                        encType="multipart/form-data"
                        className="p-2 mb-2 rounded border bg-body-tertiary"
                      >
                        <input type="hidden" name="csrf_token" value={csrf} />
                        <input type="hidden" name="parent_kind" value="contract" />
                        <input type="hidden" name="parent_id" value={c.id} />
                        <input type="hidden" name="next" value={retourIci} />
                        <div className="row g-2 align-items-end">
                          <div className="col-md-4">
                            <label className="form-label fw-medium small mb-1">Fichier</label>
                            <input
                              type="file"
                              name="file"
                              className="form-control form-control-sm"
                              required
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label fw-medium small mb-1">Catégorie</label>
                            <select
                              name="category_id"
                              className="form-select form-select-sm"
                              defaultValue=""
                            >
                              <option value="">— Non classée —</option>
                              {docCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-2">
                            <label className="form-label fw-medium small mb-1">
                              Date de l'acte
                            </label>
                            <input
                              type="date"
                              name="doc_date"
                              className="form-control form-control-sm"
                            />
                          </div>
                          <div className="col-auto">
                            <button type="submit" className="btn btn-sm btn-primary">
                              Déposer
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  ) : null}
                  {documentsEnabled && !docs.length ? (
                    <p className="marche-docs-vide mb-0">Aucun document pour ce contrat.</p>
                  ) : null}
                  {docs.length ? (
                    <ul className="list-unstyled mb-0 marche-docs">
                      {docs.map((d) => (
                        <li className="marche-doc d-flex align-items-center" key={d.id}>
                          <Lucide
                            nom="file-text"
                            taille={16}
                            classes="marche-doc-ico flex-shrink-0"
                          />
                          <div className="min-w-0 flex-grow-1">
                            <div className="marche-doc-ligne d-flex align-items-center min-w-0">
                              {!hasFile(d) ? (
                                <>
                                  <span className="marche-doc-nom text-truncate">{d.filename}</span>
                                  <span className="badge bg-light text-dark border">
                                    fichier à déposer
                                  </span>
                                </>
                              ) : (
                                <>
                                  <a
                                    href={
                                      viewable(cfg, d)
                                        ? `/documents/${d.id}/view`
                                        : `/documents/${d.id}/download`
                                    }
                                    target={viewable(cfg, d) ? "_blank" : undefined}
                                    rel={viewable(cfg, d) ? "noopener" : undefined}
                                    className="marche-doc-nom text-decoration-none text-truncate"
                                    title={`${viewable(cfg, d) ? "Ouvrir" : "Télécharger"} ${d.filename}`}
                                  >
                                    {d.filename}
                                  </a>
                                  <a
                                    href={`/documents/${d.id}/download`}
                                    className="marche-doc-dl flex-shrink-0"
                                    title={`Télécharger ${d.filename}`}
                                    aria-label={`Télécharger ${d.filename}`}
                                  >
                                    <Lucide nom="download" taille={14} />
                                  </a>
                                </>
                              )}
                            </div>
                            <small className="marche-doc-sous d-block">
                              {d.category ? d.category.label : "Non classée"}
                              {hasFile(d) ? ` · ${tailleLabel(d.size)}` : ""}
                              {d.docDate
                                ? ` · ${dateCourte(d.docDate)}`
                                : d.createdAt
                                  ? ` · ${dateCourte(d.createdAt)}`
                                  : ""}
                            </small>
                            {peutModifierDoc ? (
                              <DocumentEditMarche
                                d={d}
                                categories={docCategories}
                                csrf={csrf}
                                next={retourIci}
                              />
                            ) : null}
                          </div>
                          {peutModifierDoc || peutRetirerDoc ? (
                            <div className="d-flex gap-1 flex-shrink-0">
                              {peutModifierDoc ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost btn-icone"
                                  data-bs-toggle="collapse"
                                  data-bs-target={`#docEdit${d.id}`}
                                  title="Modifier la pièce"
                                  aria-label="Modifier la pièce"
                                >
                                  <Lucide nom="pencil" taille={16} />
                                </button>
                              ) : null}
                              {peutRetirerDoc ? (
                                <form method="POST" action={`/documents/${d.id}/delete`}>
                                  <input type="hidden" name="csrf_token" value={csrf} />
                                  <input type="hidden" name="next" value={retourIci} />
                                  <button
                                    type="submit"
                                    className="btn btn-sm btn-ghost btn-icone btn-ghost-danger"
                                    title="Supprimer la pièce et son fichier"
                                    aria-label="Supprimer la pièce et son fichier"
                                    data-confirm={`Supprimer « ${d.filename} » et son fichier ?`}
                                  >
                                    <Lucide nom="trash-2" taille={16} />
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-4 text-center text-muted">
            {item.noContractNote ? item.noContractNote : "Aucun marché rattaché à ce logiciel."}
            {peutEditer && n ? (
              // Visible seulement en mode modification, comme la liste déroulante qu'elle désigne.
              <div className="small mt-1" data-edition-seule>
                {n} marché{n > 1 ? "s" : ""} de l'éditeur ou sans logiciel{" "}
                {n > 1 ? "attendent" : "attend"} d'être {n > 1 ? "rattachés" : "rattaché"},
                ci-dessus.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** software/_consultations.html */
export function Consultations({
  item,
  consultations,
  suppliers,
  user,
  csrf,
}: {
  item: Software;
  consultations: ConsultationComplete[];
  suppliers: Supplier[];
  user: CurrentUser;
  csrf: string;
}) {
  const peutEditer = user.canEdit("contracts");
  const peutSupprimer = user.canDelete("contracts");
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom d-flex justify-content-between align-items-center">
        <h6 className="fw-bold fiche-titre fiche-titre--emerald mb-0">
          <Icone
            bi="bi-cash-coin"
            taille={14}
            classes={`ico ico-${couleurIcone("bi-cash-coin")}`}
          />
          Mise en concurrence{" "}
          <span className="badge bg-secondary ms-1">{consultations.length}</span>
        </h6>
        {peutEditer ? (
          <button
            className="btn btn-sm btn-outline-primary"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#nouvelleConsultation"
          >
            <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Devis
          </button>
        ) : null}
      </div>

      {peutEditer ? (
        <div className="collapse" id="nouvelleConsultation">
          <form
            method="POST"
            action={`/contracts/consultations/${item.id}/add`}
            className="p-3 border-bottom bg-body-tertiary"
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <div className="row g-2 align-items-end">
              <div className="col-md-7">
                <label className="form-label fw-medium small mb-1">Objet *</label>
                <input
                  type="text"
                  name="subject"
                  className="form-control form-control-sm"
                  required
                  placeholder="ex: renouvellement 2027, migration vers la v5"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Date</label>
                <input type="date" name="date" className="form-control form-control-sm" />
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-sm btn-primary w-100">
                  Ajouter
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {consultations.length ? (
        consultations.map((cons, i) => {
          const devis = [...cons.quotes].sort(
            (a, b) =>
              (a.amount ?? Number.POSITIVE_INFINITY) - (b.amount ?? Number.POSITIVE_INFINITY),
          );
          return (
            <div
              className={`p-3 ${i === consultations.length - 1 ? "" : "border-bottom"}`}
              key={cons.id}
            >
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <span className="fw-medium">{cons.subject}</span>
                  {cons.date ? (
                    <small className="text-muted ms-1">— {dateCourte(cons.date)}</small>
                  ) : null}
                  {cons.notes ? <small className="d-block text-muted">{cons.notes}</small> : null}
                </div>
                {peutSupprimer ? (
                  <form method="POST" action={`/contracts/consultations/${cons.id}/delete`}>
                    <input type="hidden" name="csrf_token" value={csrf} />
                    <button
                      type="submit"
                      className="btn btn-sm btn-outline-danger"
                      title="Supprimer la consultation"
                      aria-label="Supprimer la consultation"
                      data-confirm="Supprimer cette consultation et ses devis ?"
                    >
                      <Icone bi="bi-trash" taille="1em" />
                    </button>
                  </form>
                ) : null}
              </div>

              <table className="table table-sm mb-2">
                <thead>
                  <tr>
                    <th>Fournisseur</th>
                    <th className="text-end">Montant</th>
                    <th>Date</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {devis.length ? (
                    devis.map((d) => (
                      <tr className={d.selected ? "table-success" : undefined} key={d.id}>
                        <td>
                          {d.supplier ? d.supplier.name : d.supplierName || "—"}
                          {d.selected ? (
                            <span className="badge bg-success ms-1">Retenu</span>
                          ) : null}
                        </td>
                        <td className="text-end">
                          {d.amount !== null ? `${d.amount.toFixed(2)} €` : "—"}
                        </td>
                        <td className="small text-nowrap">{d.date ? dateCourte(d.date) : "—"}</td>
                        <td className="text-end">
                          <div className="d-flex gap-1 justify-content-end">
                            {peutEditer && !d.selected ? (
                              <form method="POST" action={`/contracts/quotes/${d.id}/select`}>
                                <input type="hidden" name="csrf_token" value={csrf} />
                                <button
                                  type="submit"
                                  className="btn btn-sm btn-outline-success"
                                  title="Marquer comme retenu"
                                  aria-label="Marquer comme retenu"
                                >
                                  <Icone bi="bi-check-lg" taille="1em" />
                                </button>
                              </form>
                            ) : null}
                            {peutSupprimer ? (
                              <form method="POST" action={`/contracts/quotes/${d.id}/delete`}>
                                <input type="hidden" name="csrf_token" value={csrf} />
                                <button
                                  type="submit"
                                  className="btn btn-sm btn-outline-danger"
                                  title="Supprimer le devis"
                                  aria-label="Supprimer le devis"
                                  data-confirm="Supprimer ce devis ?"
                                >
                                  <Icone bi="bi-trash" taille="1em" />
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-muted small py-2">
                        Aucun devis reçu pour cette consultation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {peutEditer ? (
                <form method="POST" action={`/contracts/consultations/${cons.id}/quotes/add`}>
                  <input type="hidden" name="csrf_token" value={csrf} />
                  <div className="row g-2 align-items-end">
                    <div className="col-md-4">
                      <select
                        name="supplier_id"
                        className="form-select form-select-sm"
                        defaultValue=""
                      >
                        <option value="">— Fournisseur de l'annuaire —</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <input
                        type="text"
                        name="supplier_name"
                        className="form-control form-control-sm"
                        placeholder="… ou un nom libre"
                      />
                    </div>
                    <div className="col-md-2">
                      <input
                        type="text"
                        name="amount"
                        className="form-control form-control-sm"
                        placeholder="Montant €"
                      />
                    </div>
                    <div className="col-md-2">
                      <input type="date" name="date" className="form-control form-control-sm" />
                    </div>
                    <div className="col-md-1">
                      <button
                        type="submit"
                        className="btn btn-sm btn-outline-primary w-100"
                        title="Ajouter le devis"
                        aria-label="Ajouter le devis"
                      >
                        <Icone bi="bi-plus-lg" taille="1em" />
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}
            </div>
          );
        })
      ) : (
        <div className="p-4 text-center text-muted">Aucun devis enregistré.</div>
      )}
    </div>
  );
}
