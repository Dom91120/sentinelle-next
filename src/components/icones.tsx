/**
 * Icônes (port de _icones.html) : une icône de module se dessine PARTOUT de la
 * même façon. `Icone('bi-key')` rend l'icône Lucide que lib/navigation.ts associe
 * à ce module (sprite /vendor/lucide.svg) ; une icône sans correspondance reste
 * en Bootstrap (logos de marque).
 */
import { lucideDe } from "@/lib/navigation";

export const LUCIDE_SPRITE = "/vendor/lucide.svg";

type Taille = number | string;

export function Lucide({
  nom,
  taille = 16,
  classes = "",
  style,
}: {
  nom: string;
  taille?: Taille;
  classes?: string;
  style?: string;
}) {
  return (
    <svg
      className={`lucide lucide-${nom}${classes ? ` ${classes}` : ""}`}
      width={taille}
      height={taille}
      style={style ? parseStyle(style) : undefined}
      aria-hidden="true"
    >
      <use href={`${LUCIDE_SPRITE}#${nom}`} />
    </svg>
  );
}

/** `ico_bi(bi, taille, classes, style)` */
export function Icone({
  bi,
  taille = 16,
  classes = "",
  style,
}: {
  bi: string;
  taille?: Taille;
  classes?: string;
  style?: string;
}) {
  const nom = lucideDe(bi);
  if (nom) return <Lucide nom={nom} taille={taille} classes={classes} style={style} />;
  const cls = bi.startsWith("bi-") ? bi : `bi-${bi}`;
  return (
    <i
      className={`bi ${cls}${classes ? ` ${classes}` : ""}`}
      style={style ? parseStyle(style) : undefined}
      aria-hidden="true"
    />
  );
}

/** « font-size: 2rem; color: red » → objet de style React. */
export function parseStyle(style: string): React.CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop) continue;
    const camel = prop.startsWith("--")
      ? prop
      : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = val;
  }
  return out as React.CSSProperties;
}
