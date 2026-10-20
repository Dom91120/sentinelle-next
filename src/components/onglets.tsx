/** Onglets de fiche (port de _onglets.html). */
import { Icone, Lucide } from "@/components/icones";

/** `barre(id, modifier, sur_place)` */
export function BarreOnglets({
  id,
  modifier,
  surPlace = false,
  children,
}: {
  id: string;
  modifier?: string | null;
  surPlace?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ul
      className="nav fiche-onglets"
      id={id}
      role="tablist"
      data-onglets={id}
      {...(modifier && surPlace ? { "data-edition": "" } : {})}
    >
      {children}
      {modifier ? (
        <li className="nav-item fiche-onglets-commandes" role="presentation">
          {surPlace ? (
            <button
              type="button"
              className="btn btn-ghost btn-icone js-edition"
              title="Modifier cette fiche"
              aria-label="Modifier cette fiche"
              aria-pressed="false"
            >
              <Lucide nom="square-pen" taille={16} />
            </button>
          ) : (
            <a
              href={modifier}
              className="btn btn-ghost btn-icone js-modifier"
              title="Modifier cette fiche"
              aria-label="Modifier cette fiche"
            >
              <Lucide nom="square-pen" taille={16} />
            </a>
          )}
        </li>
      ) : null}
    </ul>
  );
}

/** `onglet(cible, libelle, icone, compteur, actif)` : compteur 0 → pastille grise ; null → rien. */
export function Onglet({
  cible,
  libelle,
  icone,
  compteur,
  actif = false,
}: {
  cible: string;
  libelle: string;
  icone: string;
  compteur?: number | null;
  actif?: boolean;
}) {
  return (
    <li className="nav-item" role="presentation">
      <button
        className={`nav-link${actif ? " active" : ""}`}
        id={`ong-${cible}`}
        data-bs-toggle="tab"
        data-bs-target={`#vol-${cible}`}
        type="button"
        role="tab"
        aria-controls={`vol-${cible}`}
        aria-selected={actif ? "true" : "false"}
      >
        {icone.startsWith("bi-") ? (
          <Icone bi={icone} taille="1em" />
        ) : (
          <Lucide nom={icone} taille={16} />
        )}
        {libelle}
        {compteur !== undefined && compteur !== null ? (
          <span className={`fiche-onglet-nb${!compteur ? " est-vide" : ""}`}>{compteur}</span>
        ) : null}
      </button>
    </li>
  );
}

export function Volets({ children }: { children: React.ReactNode }) {
  return <div className="tab-content fiche-volets">{children}</div>;
}

export function Volet({
  cible,
  actif = false,
  children,
}: {
  cible: string;
  actif?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`tab-pane fade${actif ? " show active" : ""}`}
      id={`vol-${cible}`}
      role="tabpanel"
      aria-labelledby={`ong-${cible}`}
    >
      {children}
    </div>
  );
}
