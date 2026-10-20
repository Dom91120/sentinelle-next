/**
 * Le gabarit de liste (port de _liste.html, _pagination.html, _csv_toolbar.html,
 * _list_search.html) : la barre d'outils, les actions de ligne, la ligne vide,
 * la pagination et la barre CSV.
 */
import { Icone } from "@/components/icones";
import { type Pagination, PER_PAGE_CHOICES } from "@/server/paging";

/** Reconstruit une adresse avec les paramètres de la requête, modifiés. */
export function urlAvec(
  pathname: string,
  search: URLSearchParams,
  modifs: Record<string, string | number | null | undefined>,
): string {
  const p = new URLSearchParams(search);
  for (const [k, v] of Object.entries(modifs)) {
    if (v === null || v === undefined || v === "") p.delete(k);
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `${pathname}?${s}` : pathname;
}

/** `barre(q, hidden, segments, droite, placeholder)` */
export function Barre({
  q = "",
  hidden = {},
  segments,
  droite,
  placeholder = "Rechercher…",
  pathname,
  search,
}: {
  q?: string;
  hidden?: Record<string, string | null | undefined>;
  segments?: React.ReactNode;
  droite?: React.ReactNode;
  placeholder?: string;
  pathname: string;
  search: URLSearchParams;
}) {
  const keep: Record<string, string> = {};
  for (const [k, v] of Object.entries(hidden)) if (v) keep[k] = v;
  const perPage = search.get("per_page");
  if (perPage) keep.per_page = perPage;
  const effacer = (() => {
    const p = new URLSearchParams(keep);
    const s = p.toString();
    return s ? `${pathname}?${s}` : pathname;
  })();
  return (
    <div className="list-toolbar">
      <form method="GET" className="list-search" role="search">
        {Object.entries(keep).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Icone bi="bi-search" taille="1em" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          className="form-control"
          placeholder={placeholder}
          aria-label="Rechercher dans la liste"
        />
      </form>
      {q ? (
        <a href={effacer} className="btn btn-ghost btn-icon" title="Effacer la recherche">
          <Icone bi="bi-x-lg" taille="1em" classes="me-1" />
          Effacer
        </a>
      ) : null}
      {segments}
      <div className="list-toolbar-pills" data-pills />
      {droite ? <div className="list-toolbar-right">{droite}</div> : null}
    </div>
  );
}

export function Actions({ children }: { children: React.ReactNode }) {
  return <div className="row-actions">{children}</div>;
}

/** Une cellule à deux lignes : la valeur, puis un complément en petit. */
export function Cellule({
  principal,
  secondaire,
}: {
  principal: React.ReactNode;
  secondaire?: React.ReactNode;
}) {
  return (
    <div className="cell2">
      <span>{principal}</span>
      {secondaire ? <small>{secondaire}</small> : null}
    </div>
  );
}

export function BoutonModifier({ url }: { url: string }) {
  return (
    <a
      href={url}
      className="btn btn-sm btn-outline-secondary btn-icon"
      title="Modifier"
      aria-label="Modifier"
    >
      <Icone bi="bi-pencil" taille="1em" />
    </a>
  );
}

export function BoutonSupprimer({
  url,
  csrf,
  message = "Supprimer cet élément ?",
}: {
  url: string;
  csrf: string;
  message?: string;
}) {
  return (
    <form method="POST" action={url} className="d-inline">
      <input type="hidden" name="csrf_token" value={csrf} />
      <button
        type="submit"
        className="btn btn-sm btn-outline-danger btn-icon"
        title="Supprimer"
        aria-label="Supprimer"
        data-confirm={message}
      >
        <Icone bi="bi-trash" taille="1em" />
      </button>
    </form>
  );
}

/** La ligne « vide » d'une table : une icône, une phrase, le bouton d'ajout. */
export function Vide({
  colonnes,
  message,
  urlAjout,
  icone = "bi-inbox",
}: {
  colonnes: number;
  message: string;
  urlAjout?: string | null;
  icone?: string;
}) {
  return (
    <tr>
      <td colSpan={colonnes} className="text-center py-4 text-muted">
        <Icone bi={icone} taille="1em" style="font-size: 2rem;" />
        <p className="mt-2 mb-0">
          {message}{" "}
          {urlAjout ? (
            <a href={urlAjout} className="btn btn-sm btn-primary mt-1">
              <Icone bi="bi-plus-lg" taille="1em" classes="me-1" /> Ajouter le premier
            </a>
          ) : null}
        </p>
      </td>
    </tr>
  );
}

/** _pagination.html : « 1–8 sur 8 », précédent / suivant, lignes par page. */
export function PaginationBar({
  p,
  pathname,
  search,
  droite,
}: {
  p: Pagination;
  pathname: string;
  search: URLSearchParams;
  droite?: React.ReactNode;
}) {
  if (!p.pages) return null;
  const { page, pages, total, perPage } = p;
  const info =
    total && perPage
      ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} sur ${total}`
      : total
        ? `${total} élément${total > 1 ? "s" : ""}`
        : "";
  return (
    <nav className="pagination-bar" aria-label="Pagination">
      <span className="pagination-info">{info}</span>
      <span className="pagination-nav">
        {page > 1 ? (
          <a
            href={urlAvec(pathname, search, { page: page - 1 })}
            className="btn btn-outline-secondary btn-icon"
            title="Page précédente"
            aria-label="Page précédente"
          >
            <Icone bi="bi-chevron-left" taille="1em" />
          </a>
        ) : (
          <span className="btn btn-outline-secondary btn-icon disabled" aria-hidden="true">
            <Icone bi="bi-chevron-left" taille="1em" />
          </span>
        )}
        <span className="pagination-info">
          {page} / {pages}
        </span>
        {page < pages ? (
          <a
            href={urlAvec(pathname, search, { page: page + 1 })}
            className="btn btn-outline-secondary btn-icon"
            title="Page suivante"
            aria-label="Page suivante"
          >
            <Icone bi="bi-chevron-right" taille="1em" />
          </a>
        ) : (
          <span className="btn btn-outline-secondary btn-icon disabled" aria-hidden="true">
            <Icone bi="bi-chevron-right" taille="1em" />
          </span>
        )}
      </span>
      <span className="pagination-droite">
        {droite ?? (
          <select
            className="form-select pagination-perpage"
            data-href-select
            title="Lignes par page"
            aria-label="Lignes par page"
            defaultValue={
              perPage === null
                ? urlAvec(pathname, search, { page: null, per_page: "all" })
                : urlAvec(pathname, search, { page: null, per_page: perPage })
            }
          >
            {PER_PAGE_CHOICES.map((n) => (
              <option key={n} value={urlAvec(pathname, search, { page: null, per_page: n })}>
                {n} / page
              </option>
            ))}
            <option value={urlAvec(pathname, search, { page: null, per_page: "all" })}>Tous</option>
          </select>
        )}
      </span>
    </nav>
  );
}

/** _csv_toolbar.html : export / import / modèle. */
export function CsvToolbar({
  csvKey,
  canEdit,
  csrf,
}: {
  csvKey: string;
  canEdit: boolean;
  csrf: string;
}) {
  return (
    <div className="dropdown d-inline-block">
      <button
        className="btn btn-outline-secondary dropdown-toggle"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        <Icone bi="bi-download" taille="1em" classes="me-1" /> Exporter
      </button>
      <div className="dropdown-menu dropdown-menu-end p-3" style={{ minWidth: 280 }}>
        <a
          className="btn btn-sm btn-outline-primary w-100 mb-2"
          href={`/data/${csvKey}/export.csv`}
        >
          <Icone bi="bi-download" taille="1em" classes="me-1" /> Exporter
        </a>
        {canEdit ? (
          <>
            <hr className="my-2" />
            <form method="POST" action={`/data/${csvKey}/import`} encType="multipart/form-data">
              <input type="hidden" name="csrf_token" value={csrf} />
              <label className="form-label small mb-1 fw-medium">Importer un fichier CSV</label>
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                className="form-control form-control-sm mb-2"
                required
              />
              <button type="submit" className="btn btn-sm btn-primary w-100">
                <Icone bi="bi-upload" taille="1em" classes="me-1" /> Importer
              </button>
            </form>
            <a className="small d-block mt-2 text-muted" href={`/data/${csvKey}/template.csv`}>
              <Icone bi="bi-file-earmark-arrow-down" taille="1em" classes="me-1" /> Télécharger le
              modèle d'import
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Onglets de type (segments) d'une liste. */
export function SegTabs({
  tabs,
}: {
  tabs: { href: string; label: React.ReactNode; count?: number | null; active: boolean }[];
}) {
  return (
    <div className="seg-tabs">
      {tabs.map((t) => (
        <a key={t.href} className={`seg-tab${t.active ? " active" : ""}`} href={t.href}>
          {t.label}
          {t.count !== undefined && t.count !== null ? (
            <span className="seg-tab-count">{t.count}</span>
          ) : null}
        </a>
      ))}
    </div>
  );
}
