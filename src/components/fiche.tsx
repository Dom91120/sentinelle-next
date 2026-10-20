/**
 * Le gabarit de fiche (port de _fiche.html et _fiche_section.html) : en-tête,
 * voisins, menu ⋯, bandeau d'échéance, fenêtre d'action, cartes du rail,
 * historique, activité.
 */

import { Icone, Lucide } from "@/components/icones";
import { DelaiBadge, StatusBadge } from "@/components/macros";
import type { Supplier } from "@/generated/prisma/client";
import { dateCourte, dateHeure, jours } from "@/lib/libelles";
import { couleurIcone } from "@/lib/navigation";
import type { Voisins } from "@/server/voisins";

/** Chevrons précédent / suivant. `base` : le chemin de la liste (« /accounts »). */
export function FicheVoisins({ voisins, base }: { voisins?: Voisins | null; base: string }) {
  if (!voisins || (!voisins[0] && !voisins[1])) return null;
  const [prec, suiv] = voisins;
  return (
    <div className="btn-group fiche-voisins" role="group" aria-label="Feuilleter les fiches">
      {prec ? (
        <a
          href={`${base}/${prec.id}`}
          className="btn btn-outline-secondary btn-icon"
          title={`Précédente : ${prec.nom}`}
          aria-label={`Fiche précédente : ${prec.nom}`}
        >
          <Icone bi="bi-chevron-left" taille="1em" />
        </a>
      ) : (
        <span className="btn btn-outline-secondary btn-icon disabled" aria-hidden="true">
          <Icone bi="bi-chevron-left" taille="1em" />
        </span>
      )}
      {suiv ? (
        <a
          href={`${base}/${suiv.id}`}
          className="btn btn-outline-secondary btn-icon"
          title={`Suivante : ${suiv.nom}`}
          aria-label={`Fiche suivante : ${suiv.nom}`}
        >
          <Icone bi="bi-chevron-right" taille="1em" />
        </a>
      ) : (
        <span className="btn btn-outline-secondary btn-icon disabled" aria-hidden="true">
          <Icone bi="bi-chevron-right" taille="1em" />
        </span>
      )}
    </div>
  );
}

export type EnteteProps = {
  titre: React.ReactNode;
  sousTitre?: React.ReactNode;
  statut?: string | null;
  primaire?: React.ReactNode;
  /** Entrées du menu ⋯ : MenuLien / MenuPost / MenuSep. Une seule entrée devient un bouton à icône. */
  menu?: React.ReactNode[];
  badges?: React.ReactNode;
  voisins?: Voisins | null;
  base?: string;
  bandeau?: React.ReactNode;
};

function estSeparateur(n: React.ReactNode): boolean {
  return Boolean(
    n && typeof n === "object" && "type" in n && (n as React.ReactElement).type === MenuSep,
  );
}

export function Entete({
  titre,
  sousTitre,
  statut,
  primaire,
  menu = [],
  badges,
  voisins,
  base = "",
  bandeau,
}: EnteteProps) {
  const entrees = menu.filter(
    (m) => m !== null && m !== undefined && m !== false && !estSeparateur(m),
  ).length;
  return (
    <div className="page-header fiche-entete">
      <div className="fiche-entete-titre">
        <h1 className="page-title">
          {titre}
          {statut ? (
            <>
              {" "}
              <StatusBadge status={statut} />
            </>
          ) : null}
          {badges}
        </h1>
        {sousTitre ? <p className="page-subtitle">{sousTitre}</p> : null}
      </div>
      {bandeau ? <div className="fiche-entete-bandeau">{bandeau}</div> : null}
      <div className="page-actions fiche-actions">
        <FicheVoisins voisins={voisins} base={base} />
        {primaire || entrees ? (
          <div className="fiche-actions-ligne">
            {primaire}
            {entrees === 1 ? (
              <ul className="menu-seul">{menu}</ul>
            ) : entrees > 1 ? (
              <div className="dropdown">
                <button
                  className="btn btn-outline-secondary btn-icon"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  title="Autres actions"
                  aria-label="Autres actions"
                >
                  <Icone bi="bi-three-dots" taille="1em" />
                </button>
                <ul className="dropdown-menu dropdown-menu-end">{menu}</ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MenuLien({
  url,
  libelle,
  icone,
  cible,
}: {
  url: string;
  libelle: string;
  icone: string;
  cible?: string;
}) {
  return (
    <li>
      <a
        className="dropdown-item"
        href={url}
        title={libelle}
        target={cible}
        rel={cible ? "noopener" : undefined}
      >
        <Icone bi={icone} taille="1em" classes="me-2" />
        <span className="menu-libelle">{libelle}</span>
      </a>
    </li>
  );
}

export function MenuPost({
  url,
  libelle,
  icone,
  csrf,
  confirm,
  danger = false,
  champs,
}: {
  url: string;
  libelle: string;
  icone: string;
  csrf: string;
  confirm?: string;
  danger?: boolean;
  champs?: Record<string, string>;
}) {
  return (
    <li>
      <form method="POST" action={url}>
        <input type="hidden" name="csrf_token" value={csrf} />
        {champs
          ? Object.entries(champs).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))
          : null}
        <button
          type="submit"
          className={`dropdown-item${danger ? " text-danger" : ""}`}
          title={libelle}
          data-confirm={confirm}
        >
          <Icone bi={icone} taille="1em" classes="me-2" />
          <span className="menu-libelle">{libelle}</span>
        </button>
      </form>
    </li>
  );
}

export function MenuSep() {
  return (
    <li>
      <hr className="dropdown-divider" />
    </li>
  );
}

/** Le bouton principal, qui ouvre la fenêtre d'action. */
export function BoutonModal({
  id,
  libelle,
  icone = "bi-check-lg",
  classe = "btn-primary",
}: {
  id: string;
  libelle: string;
  icone?: string;
  classe?: string;
}) {
  return (
    <button
      type="button"
      className={`btn ${classe}`}
      data-bs-toggle="modal"
      data-bs-target={`#${id}`}
    >
      <Icone bi={icone} taille="1em" classes="me-1" /> {libelle}
    </button>
  );
}

/** La fenêtre d'action : un formulaire POST, ses champs en children. */
export function ModalAction({
  id,
  titre,
  action,
  csrf,
  bouton = "Enregistrer",
  aide,
  icone = "bi-check-lg",
  children,
  multipart,
}: {
  id: string;
  titre: string;
  action: string;
  csrf: string;
  bouton?: string;
  aide?: string;
  icone?: string;
  children: React.ReactNode;
  multipart?: boolean;
}) {
  return (
    <div
      className="modal fade"
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-titre`}
      aria-hidden="true"
    >
      <div className="modal-dialog">
        <form
          method="POST"
          action={action}
          className="modal-content"
          encType={multipart ? "multipart/form-data" : undefined}
        >
          <input type="hidden" name="csrf_token" value={csrf} />
          <div className="modal-header">
            <h5 className="modal-title" id={`${id}-titre`}>
              {titre}
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Fermer"
            />
          </div>
          <div className="modal-body">
            {aide ? <p className="text-muted small mb-3">{aide}</p> : null}
            {children}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              <Icone bi={icone} taille="1em" classes="me-1" /> {bouton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Le bandeau d'échéance : LA date, son délai, une frise du début à l'échéance. */
export function BandeauEcheance({
  libelle,
  date,
  statut,
  passe = "retard",
  debut,
  complement,
  sansDate = "à renseigner",
  seuilLibelle,
}: {
  libelle: string;
  date: Date | null | undefined;
  statut: string | null | undefined;
  passe?: string;
  debut?: Date | null;
  complement?: React.ReactNode;
  sansDate?: string;
  seuilLibelle?: string;
}) {
  let frise: React.ReactNode = null;
  if (date && debut && debut < date) {
    const restant = jours(date) ?? 0;
    const total = Math.round((date.getTime() - debut.getTime()) / 86_400_000);
    const ecoule = total - restant;
    const pct =
      Math.round((ecoule >= total ? 100 : ecoule <= 0 ? 0 : (ecoule * 100) / total) * 10) / 10;
    frise = (
      <>
        <div className="fiche-frise" role="img" aria-label={`${pct} % de la période écoulée`}>
          <span className="fiche-frise-fait" style={{ width: `${pct}%` }} />
        </div>
        <div className="fiche-frise-legende">
          <span>{dateCourte(debut)}</span>
          {seuilLibelle ? <span>{seuilLibelle}</span> : null}
          <span>{dateCourte(date)}</span>
        </div>
      </>
    );
  }
  return (
    <div className={`data-card fiche-bandeau fiche-bandeau--${statut || "muted"}`}>
      <div className="fiche-bandeau-ligne">
        <span className="fiche-bandeau-k">{libelle}</span>
        {date ? (
          <>
            <strong className="fiche-bandeau-date">{dateCourte(date)}</strong>
            <DelaiBadge days={date} status={statut} passe={passe} />
          </>
        ) : (
          <span className="text-muted">{sansDate}</span>
        )}
        {complement ? <span className="fiche-bandeau-c">{complement}</span> : null}
      </div>
      {frise}
    </div>
  );
}

/** Le rail droit : « Lié à ». */
export function Lie({ titre = "Lié à", children }: { titre?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom">
        <h6 className="fw-bold mb-0">
          <Icone bi="bi-link-45deg" taille="1em" classes="me-2" />
          {titre}
        </h6>
      </div>
      <div className="fiche-lies">{children}</div>
    </div>
  );
}

export function Lien({
  url,
  icone,
  nom,
  sous,
  cible,
  teinte,
}: {
  url: string;
  icone: string;
  nom: React.ReactNode;
  sous?: React.ReactNode;
  cible?: string;
  teinte?: string;
}) {
  return (
    <a href={url} className="fiche-lie" target={cible} rel={cible ? "noopener" : undefined}>
      {icone.startsWith("bi-") ? (
        <Icone bi={icone} taille="1em" />
      ) : (
        <Lucide nom={icone} taille={16} classes={teinte ? `kind-icon--${teinte}` : ""} />
      )}
      <span className="cell2">
        <strong>{nom}</strong>
        {sous ? <small>{sous}</small> : null}
      </span>
    </a>
  );
}

/** Un fournisseur dans le rail : nom, hotline, n° client, portail. */
export function CarteFournisseur({
  sup,
  titre = "Fournisseur",
}: {
  sup: Supplier | null | undefined;
  titre?: string;
}) {
  if (!sup) return null;
  const tel = sup.supportPhone || sup.phone;
  const mail = sup.supportEmail || sup.email;
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom">
        <h6 className="fw-bold mb-0">
          <Icone bi="bi-building" taille="1em" classes="me-2 ico-carte ico-violet" />
          {titre}
        </h6>
      </div>
      <div className="p-3">
        <div className="fw-medium mb-1">
          <a href={`/suppliers/${sup.id}`}>{sup.name}</a>
          {sup.customerRef ? (
            <span className="text-muted small ms-1">
              n° client <code>{sup.customerRef}</code>
            </span>
          ) : null}
        </div>
        <ul className="list-unstyled small mb-0">
          {tel ? (
            <li>
              <Icone bi="bi-telephone" taille="1em" classes="me-1 text-muted" />
              <a href={`tel:${tel.replace(/ /g, "")}`}>{tel}</a>
              {sup.hours ? <span className="text-muted"> · {sup.hours}</span> : null}
            </li>
          ) : null}
          {mail ? (
            <li>
              <Icone bi="bi-envelope" taille="1em" classes="me-1 text-muted" />
              <a href={`mailto:${mail}`}>{mail}</a>
            </li>
          ) : null}
          {sup.supportUrl ? (
            <li>
              <Icone bi="bi-box-arrow-up-right" taille="1em" classes="me-1 text-muted" />
              <a href={sup.supportUrl} target="_blank" rel="noopener">
                Portail support
              </a>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

/** La carte d'un éditeur ou d'un fournisseur, dans le rail. */
export function CarteEditeur({
  sup,
  role = "Fournisseur",
}: {
  sup: Supplier | null | undefined;
  role?: string;
}) {
  if (!sup) return null;
  const tel = sup.supportPhone || sup.phone;
  const mail = sup.supportEmail || sup.email;
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom">
        <h6 className="fw-bold mb-0 d-flex align-items-center min-w-0 editeur-titre">
          <Icone
            bi="bi-building"
            taille="1em"
            classes={`me-2 flex-shrink-0 ico-carte ico-${couleurIcone("bi-building")}`}
          />
          <a
            href={`/suppliers/${sup.id}`}
            className="text-truncate"
            title={`${role} : ${sup.name}`}
          >
            {sup.name}
          </a>
        </h6>
      </div>
      <div className="p-3">
        {sup.customerRef ? (
          <div className="small mb-1">
            <span className="text-muted">N° client</span>{" "}
            <span className="fw-medium">{sup.customerRef}</span>
          </div>
        ) : null}
        <ul className="list-unstyled small mb-0 editeur-coordonnees">
          {sup.supportUrl ? (
            <li className="text-truncate">
              <Icone bi="bi-life-preserver" taille="1em" classes="me-1" />
              <a href={sup.supportUrl} target="_blank" rel="noopener">
                Portail de tickets
              </a>
            </li>
          ) : null}
          {tel ? (
            <li className="text-truncate">
              <Icone bi="bi-telephone" taille="1em" classes="me-1" />
              {tel}
            </li>
          ) : null}
          {mail ? (
            <li className="text-truncate">
              <Icone bi="bi-envelope" taille="1em" classes="me-1" />
              <a href={`mailto:${mail}`}>{mail}</a>
            </li>
          ) : null}
          {sup.dpoEmail ? (
            <li
              className="text-truncate"
              title={`DPO${sup.dpoContact ? ` — ${sup.dpoContact}` : ""}`}
            >
              <Icone bi="bi-envelope" taille="1em" classes="me-1" />
              <a href={`mailto:${sup.dpoEmail}`}>{sup.dpoEmail}</a>
            </li>
          ) : null}
        </ul>
        {sup.hours || sup.hours2 ? (
          <ul className="list-unstyled small mb-0 mt-1">
            {sup.hours ? (
              <li className="text-muted">
                <Icone bi="bi-clock" taille="1em" classes="me-1" />
                {sup.hours}
              </li>
            ) : null}
            {sup.hours2 ? (
              <li className="text-muted">
                <Icone bi="bi-clock" taille="1em" classes="invisible me-1" />
                {sup.hours2}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export type Histo = {
  id: number;
  performedAt: Date | null;
  action: string;
  comment: string | null;
  performedBy: string | null;
  result?: string | null;
};

/** L'historique, en volet. */
export function Historique({
  histories,
  titre = "Historique",
}: {
  histories: Histo[];
  titre?: string;
}) {
  return (
    <div className="data-card">
      <div className="card-header-custom">
        <h6 className="fw-bold mb-0">
          <Icone bi="bi-clock-history" taille="1em" classes="me-2" />
          {titre}
        </h6>
      </div>
      <div className="table-responsive">
        <table className="table table-hover mb-0">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Commentaire</th>
              <th>Par</th>
            </tr>
          </thead>
          <tbody>
            {histories.length ? (
              histories.map((h) => (
                <tr key={h.id}>
                  <td className="text-nowrap">{h.performedAt ? dateHeure(h.performedAt) : "—"}</td>
                  <td>{h.action}</td>
                  <td>
                    {h.result ? (
                      <>
                        {h.result}
                        <br />
                      </>
                    ) : null}
                    {h.comment || "—"}
                  </td>
                  <td className="text-nowrap">{h.performedBy || "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-3 text-muted">
                  Aucun historique
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Les trois dernières lignes d'activité, dans le rail. */
export function Activite({
  histories,
  cible = "historique",
}: {
  histories: Histo[];
  cible?: string;
}) {
  if (!histories.length) return null;
  return (
    <div className="data-card mb-3">
      <div className="card-header-custom">
        <h6 className="fw-bold mb-0">
          <Icone bi="bi-activity" taille="1em" classes="me-2 ico-carte ico-amber" />
          Activité
        </h6>
        <button type="button" className="btn btn-ghost btn-sm" data-ouvrir-onglet={cible}>
          Tout l'historique
        </button>
      </div>
      <div className="fiche-activite">
        {histories.slice(0, 3).map((h) => (
          <div key={h.id} className="cell2">
            <span>
              {h.action}
              {h.comment ? <span className="text-muted"> · {h.comment}</span> : null}
            </span>
            <small>
              {h.performedAt ? dateHeure(h.performedAt) : ""}
              {h.performedBy ? ` · ${h.performedBy}` : ""}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── _fiche_section.html ──

export function TitreSection({
  titre,
  icone,
  couleur = "indigo",
  classes = "mb-2 mt-3",
}: {
  titre: string;
  icone: string;
  couleur?: string;
  classes?: string;
}) {
  return (
    <h6 className={`fw-bold fiche-titre fiche-titre--${couleur} ${classes}`}>
      <Icone bi={icone} taille={14} classes={`ico ico-${couleurIcone(icone)}`} />
      {titre}
    </h6>
  );
}

export function Champ({
  label,
  value,
  large = false,
}: {
  label: string;
  value: React.ReactNode;
  large?: boolean;
}) {
  if (value === null || value === undefined || value === "" || value === false) return null;
  return (
    <div className={`fiche-champ${large ? " fiche-champ--large" : ""}`}>
      <span className="fiche-label">{label}</span>
      <span className="fiche-valeur">{value}</span>
    </div>
  );
}

export const ChampBloc = Champ;

/** Le bandeau de faits. */
export function Faits({ children }: { children: React.ReactNode }) {
  return <div className="fiche-faits">{children}</div>;
}

export function Fait({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="fiche-fait">
      <span className="fiche-fait-k">{label}</span>
      <div className="fiche-fait-v">
        {value === null || value === undefined || value === "" ? "-" : value}
      </div>
    </div>
  );
}

export function FaitBloc({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fiche-fait">
      <span className="fiche-fait-k">{label}</span>
      <div className="fiche-fait-v">{children}</div>
    </div>
  );
}
