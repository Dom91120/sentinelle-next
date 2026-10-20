/** Petits outils de lecture du HTML rendu par React (attributs booléens `selected=""`, apostrophes `&#x27;`). */

/** L'option `value` est-elle sélectionnée (quel que soit l'ordre des attributs) ? */
export function optionSelectionnee(html: string, value: string | number): boolean {
  const v = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`<option[^>]*value="${v}"[^>]*selected(?:=""|)[\\s>]`).test(html) ||
    new RegExp(`<option[^>]*selected(?:=""|)[^>]*value="${v}"[\\s>]`).test(html)
  );
}

/** Le texte tel que React l'écrit dans le HTML (apostrophes et guillemets échappés). */
export function texteHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
}

/** La balise `<a …>` qui porte ce lien. */
export function baliseLien(html: string, href: string): string {
  const i = html.indexOf(`href="${href}"`);
  if (i < 0) return "";
  const debut = html.lastIndexOf("<a", i);
  return html.slice(debut, html.indexOf(">", i) + 1);
}

/** Le contenu entre deux repères (`split` de Python, premier intervalle). */
export function entre(html: string, debut: string, fin: string): string {
  const i = html.indexOf(debut);
  if (i < 0) return "";
  const reste = html.slice(i + debut.length);
  const j = reste.indexOf(fin);
  return j < 0 ? reste : reste.slice(0, j);
}

/** Les noms des entrées d'une archive ZIP (en-têtes locaux). */
export function nomsDuZip(buf: Buffer): string[] {
  const noms: string[] = [];
  let i = 0;
  while (i + 30 <= buf.length) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const taille = buf.readUInt32LE(i + 18);
    const nomLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const flags = buf.readUInt16LE(i + 6);
    noms.push(buf.toString("utf8", i + 30, i + 30 + nomLen));
    i += 30 + nomLen + extraLen + taille;
    if (flags & 0x8) {
      // descripteur de données : on cherche la prochaine signature
      const prochain = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), i);
      if (prochain < 0) break;
      i = prochain;
    }
  }
  return noms;
}
