/** Pièces jointes d'une fiche (port de _documents.html et _document_edit.html). */

import { Icone, Lucide } from "@/components/icones";
import type { Referential } from "@/generated/prisma/client";
import { dateCourte, tailleLabel } from "@/lib/libelles";
import { couleurIcone } from "@/lib/navigation";
import {
  type DocumentAvecCategorie,
  docCategories,
  documentsEnabled,
  forParent,
  hasFile,
  viewable,
} from "@/server/documents";
import type { CurrentUser } from "@/server/guards";

export type DocumentsProps = {
  parentKind: string;
  parentId: number;
  permission: string;
  user: CurrentUser;
  csrf: string;
  title?: string;
};

function isoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function DocumentEdit({
  d,
  avecDates,
  categories,
  csrf,
  next = "",
}: {
  d: DocumentAvecCategorie;
  avecDates: boolean;
  categories: Referential[];
  csrf: string;
  next?: string;
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
          {avecDates ? (
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1">Date de l'acte</label>
              <input
                type="date"
                name="doc_date"
                className="form-control form-control-sm"
                defaultValue={isoDate(d.docDate)}
              />
            </div>
          ) : null}
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

export async function Documents({
  parentKind,
  parentId,
  permission,
  user,
  csrf,
  title = "Pièces jointes",
}: DocumentsProps) {
  const cfg = user.settings;
  if (!documentsEnabled(cfg)) return null;
  const [pieces, categories] = await Promise.all([
    forParent(parentKind, parentId),
    docCategories(),
  ]);
  const peutDeposer = user.canEdit(permission);
  const peutRetirer = user.canDelete(permission);
  const avecDates = parentKind === "contract";
  const maxMb = cfg.DOCUMENT_MAX_MB || 10;
  const aideDepot = `${maxMb} Mo maximum. Actes scannés, guides, tableurs, images — pas une image disque : au-delà, c'est le partage réseau qu'il faut.`;
  const idDepot = `depot${parentKind}${parentId}`;
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom d-flex justify-content-between align-items-center">
        <h6 className="fw-bold fiche-titre fiche-titre--indigo mb-0">
          <Icone
            bi="bi-paperclip"
            taille={14}
            classes={`ico ico-${couleurIcone("bi-paperclip")}`}
          />
          {title} <span className="badge bg-secondary ms-1">{pieces.length}</span>
        </h6>
        {peutDeposer ? (
          <button
            className="btn btn-sm btn-ghost btn-icone"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target={`#${idDepot}`}
            title="Déposer une pièce"
            aria-label="Déposer une pièce"
          >
            <Lucide nom="plus" taille={16} />
          </button>
        ) : null}
      </div>

      {peutDeposer ? (
        <div className="collapse" id={idDepot}>
          <form
            method="POST"
            action="/documents/upload"
            encType="multipart/form-data"
            className="doc-depot p-2 border-bottom bg-body-tertiary"
          >
            <input type="hidden" name="csrf_token" value={csrf} />
            <input type="hidden" name="parent_kind" value={parentKind} />
            <input type="hidden" name="parent_id" value={parentId} />
            <div className="row g-2 align-items-start">
              <div className="col min-w-0">
                <label
                  className="form-label fw-medium small mb-1"
                  htmlFor={`depotNom${parentKind}${parentId}`}
                >
                  Nom du fichier
                </label>
                <input
                  type="text"
                  name="filename"
                  id={`depotNom${parentKind}${parentId}`}
                  className="form-control form-control-sm"
                  maxLength={180}
                  placeholder="Aucun fichier choisi"
                />
                <div className="form-text doc-aide text-truncate" title={aideDepot}>
                  {aideDepot}
                </div>
              </div>
              <div className="col-auto">
                <label className="form-label small mb-1 d-block">&nbsp;</label>
                <input
                  type="file"
                  name="file"
                  id={`depotFichier${parentKind}${parentId}`}
                  className="d-none"
                  data-fichier-nom
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary btn-icone"
                  data-titre="Choisir le fichier"
                  title="Choisir le fichier"
                  aria-label="Choisir le fichier"
                  data-click-prev
                >
                  <Lucide nom="upload" taille={16} />
                </button>
              </div>
              <div className="col-auto">
                <label className="form-label fw-medium small mb-1">Catégorie</label>
                <select name="category_id" className="form-select form-select-sm" defaultValue="">
                  <option value="">— Non classée —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              {avecDates ? (
                <div className="col-auto">
                  <label className="form-label fw-medium small mb-1">Date de l'acte</label>
                  <input type="date" name="doc_date" className="form-control form-control-sm" />
                </div>
              ) : null}
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
                    data-bs-target={`#${idDepot}`}
                  >
                    <Lucide nom="x" taille={16} />
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      <div className="px-3 pt-2 pb-3">
        {pieces.length ? (
          <ul className="list-unstyled mb-0 docs-liste">
            {pieces.map((d) => (
              <li key={d.id} className="d-flex align-items-center">
                <Lucide nom="file-text" taille={16} classes="doc-ico flex-shrink-0" />
                <div className="min-w-0 flex-grow-1">
                  <div className="docs-ligne d-flex align-items-center min-w-0">
                    {!hasFile(d) ? (
                      <>
                        <span className="fw-medium text-truncate">{d.filename}</span>
                        <span className="badge bg-light text-dark border">fichier à déposer</span>
                      </>
                    ) : viewable(cfg, d) ? (
                      <>
                        <a
                          href={`/documents/${d.id}/view`}
                          target="_blank"
                          rel="noopener"
                          className="fw-medium text-decoration-none text-truncate"
                          title={`Ouvrir ${d.filename}`}
                        >
                          {d.filename}
                        </a>
                        <a
                          href={`/documents/${d.id}/download`}
                          className="doc-dl flex-shrink-0"
                          title={`Télécharger ${d.filename}`}
                          aria-label={`Télécharger ${d.filename}`}
                        >
                          <Lucide nom="download" taille={14} />
                        </a>
                      </>
                    ) : (
                      <>
                        <a
                          href={`/documents/${d.id}/download`}
                          className="fw-medium text-decoration-none text-truncate"
                          title={`Télécharger ${d.filename}`}
                        >
                          {d.filename}
                        </a>
                        <a
                          href={`/documents/${d.id}/download`}
                          className="doc-dl flex-shrink-0"
                          title={`Télécharger ${d.filename}`}
                          aria-label={`Télécharger ${d.filename}`}
                        >
                          <Lucide nom="download" taille={14} />
                        </a>
                      </>
                    )}
                  </div>
                  <div className="doc-sous">
                    {d.category ? d.category.label : "Non classée"}
                    {hasFile(d) ? ` · ${tailleLabel(d.size)}` : ""}
                    {d.uploadedBy ? ` · déposé par ${d.uploadedBy}` : ""}
                    {avecDates && d.docDate ? ` · acte du ${dateCourte(d.docDate)}` : ""}
                    {d.createdAt ? ` · ${dateCourte(d.createdAt)}` : ""}
                  </div>
                  {!hasFile(d) && peutDeposer ? (
                    <form
                      method="POST"
                      action={`/documents/${d.id}/file`}
                      encType="multipart/form-data"
                      className="d-flex gap-1 mt-1"
                      style={{ maxWidth: "24rem" }}
                    >
                      <input type="hidden" name="csrf_token" value={csrf} />
                      <input
                        type="file"
                        name="file"
                        className="form-control form-control-sm"
                        required
                      />
                      <button type="submit" className="btn btn-sm btn-outline-primary text-nowrap">
                        Déposer
                      </button>
                    </form>
                  ) : null}
                  {peutDeposer ? (
                    <DocumentEdit d={d} avecDates={avecDates} categories={categories} csrf={csrf} />
                  ) : null}
                </div>
                {peutDeposer || peutRetirer ? (
                  <div className="d-flex gap-1 flex-shrink-0">
                    {peutDeposer ? (
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
                    {peutRetirer ? (
                      <form method="POST" action={`/documents/${d.id}/delete`}>
                        <input type="hidden" name="csrf_token" value={csrf} />
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
        ) : (
          <p className="text-muted mb-0 pt-2">Aucune pièce jointe</p>
        )}
      </div>
    </div>
  );
}
