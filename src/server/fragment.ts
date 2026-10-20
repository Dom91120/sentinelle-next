/**
 * Un fragment HTML (un formulaire rendu SEUL, pour formulaire-inline.js) obtenu en
 * rendant une page de l'application puis en n'en gardant que le bloc `#fragment`.
 *
 * Pourquoi ce détour : un gestionnaire de route ne peut pas appeler
 * `react-dom/server` (Next l'interdit dans la couche serveur) ; la page, elle, rend
 * le composant comme n'importe quel écran. On la demande au serveur lui-même, avec
 * les cookies de l'appelant (session, CSRF), et on découpe le résultat.
 */

const DEBUT = '<div id="fragment">';

/** Rend `chemin` (une page de l'application) pour l'appelant et renvoie le contenu de `#fragment`. */
export async function fragmentDepuisPage(req: Request, chemin: string): Promise<Response> {
  const origine = new URL(req.url).origin;
  const r = await fetch(`${origine}${chemin}`, {
    headers: { cookie: req.headers.get("cookie") ?? "", "x-requested-with": "fetch" },
    cache: "no-store",
    redirect: "manual",
  });
  if (r.status >= 300 && r.status < 400) {
    // Non connecté, module coupé… : le fragment suit la page.
    return new Response(null, {
      status: r.status,
      headers: { Location: r.headers.get("location") ?? "/" },
    });
  }
  const html = await r.text();
  if (!r.ok)
    return new Response(html, {
      status: r.status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  const debut = html.indexOf(DEBUT);
  const fin = html.lastIndexOf("<!--/fragment-->");
  const corps = debut >= 0 && fin > debut ? html.slice(debut + DEBUT.length, fin) : html;
  return new Response(corps, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
