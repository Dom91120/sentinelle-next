/**
 * La Synthèse d'une fiche (port de _synthese.html) : les rubriques dans UNE carte,
 * l'intitulé à gauche, la valeur en face. Un champ vide laisse un marqueur
 * `data-manque` ; la ligne « À compléter » est assemblée par synthese.js.
 */
import { Icone, Lucide } from "@/components/icones";

export function Rubrique({
  titre,
  bi,
  couleur,
  onglet,
  droite,
  colonnes = 3,
  children,
}: {
  titre: string;
  bi: string;
  couleur: string;
  onglet?: string;
  droite?: React.ReactNode;
  colonnes?: number;
  children: React.ReactNode;
}) {
  let icone: React.ReactNode;
  if (onglet) icone = <Icone bi={bi} taille="1em" classes={`ico-onglet ico-onglet--${onglet}`} />;
  else if (bi.startsWith("bi-"))
    icone = <Icone bi={bi} taille={14} classes={`ico ico-${couleur}`} />;
  else icone = <Lucide nom={bi} taille={14} classes={`ico ico-${couleur}`} />;
  return (
    <>
      <div className="card-header-custom d-flex justify-content-between align-items-center">
        <h6 className={`fw-bold fiche-titre fiche-titre--${couleur} mb-0`}>
          {icone}
          {titre}
        </h6>
        {droite ? <div className="d-flex gap-1">{droite}</div> : null}
      </div>
      <div className="p-3">
        <div
          className={`lu-grille${colonnes === 3 || colonnes === 4 ? ` lu-grille--${colonnes}` : ""}`}
          data-manques
        >
          {children}
        </div>
      </div>
    </>
  );
}

export function Rangee({ children }: { children: React.ReactNode }) {
  return <div className="lu-rangee">{children}</div>;
}

function vide(v: unknown): boolean {
  return v === null || v === undefined || v === "" || v === false;
}

/** `lu(label, valeur, large, titre, pleine, facultatif, texte)` */
export function Lu({
  label,
  valeur,
  large = false,
  titre,
  pleine = false,
  facultatif = false,
  texte = false,
}: {
  label: string;
  valeur: React.ReactNode;
  large?: boolean;
  titre?: string;
  pleine?: boolean;
  facultatif?: boolean;
  texte?: boolean;
}) {
  if (vide(valeur)) return facultatif ? null : <span hidden data-manque={label} />;
  return (
    <div
      className={`lu${large ? " lu--large" : ""}${pleine ? " lu--pleine" : ""}${texte ? " lu--texte" : ""}`}
    >
      <span className="lu-label" title={titre}>
        {label}
      </span>
      <span className="lu-valeur">{valeur}</span>
    </div>
  );
}

/** `lu_bloc(label)` : même chose quand la valeur est du balisage. `children` null/false = vide. */
export function LuBloc({
  label,
  children,
  large = false,
  titre,
  pleine = false,
  facultatif = false,
}: {
  label: string;
  children: React.ReactNode;
  large?: boolean;
  titre?: string;
  pleine?: boolean;
  facultatif?: boolean;
}) {
  if (vide(children)) return facultatif ? null : <span hidden data-manque={label} />;
  return (
    <div className={`lu${large ? " lu--large" : ""}${pleine ? " lu--pleine" : ""}`}>
      <span className="lu-label" title={titre}>
        {label}
      </span>
      <span className="lu-valeur">{children}</span>
    </div>
  );
}

/** Un montant en euros, espaces de milliers, sans centimes quand il n'y en a pas. */
export function euros(m: number | null | undefined): string {
  if (m === null || m === undefined) return "";
  const entier = m === Math.trunc(m);
  const s = entier ? m.toFixed(0) : m.toFixed(2);
  const [ent, dec] = s.split(".");
  const groupes = ent.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${dec !== undefined ? `${groupes},${dec}` : groupes} €`;
}

/** Un élément lié, en pastille. */
export function Pastille({
  url,
  nomIcone,
  nom,
  teinte,
  titre,
}: {
  url: string;
  nomIcone: string;
  nom: React.ReactNode;
  teinte: string;
  titre?: string;
}) {
  return (
    <a href={url} className="pastille-lien" title={titre}>
      <Lucide nom={nomIcone} taille={14} classes={`kind-icon--${teinte}`} />
      {nom}
    </a>
  );
}
