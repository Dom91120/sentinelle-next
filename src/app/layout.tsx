import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { primaryCssOverride } from "@/lib/theming";
import { getSettings } from "@/server/config-store";

export const metadata: Metadata = {
  title: "Sentinelle",
  description: "Supervision et inventaire de la DSI.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export const dynamic = "force-dynamic";

/** `static_v('css/style.css')` : une version qui change avec le fichier, pour forcer le rechargement. */
const CSS_VERSION = (() => {
  try {
    const octets = readFileSync(path.join(process.cwd(), "public", "css", "sentinelle.css"));
    return createHash("sha256").update(octets).digest("hex").slice(0, 10);
  } catch {
    return "1";
  }
})();

// Anti-FOUC (base.html) : applique le thème et la couleur de fond avant le premier
// rendu, pour éviter le flash noir sur OS dark-mode quand le CSS n'est pas encore chargé.
const BOOT =
  "(function(){try{var t=new URLSearchParams(location.search).get('theme')||localStorage.getItem('theme')||'light';var h=document.documentElement;h.setAttribute('data-theme',t);h.style.backgroundColor=t==='dark'?'#0b1120':'#f5f6f8';}catch(e){}})();";
// L'ancre (#documents…) dit quel onglet ouvrir : le volet reste voilé jusqu'à ce qu'onglets.js l'ait ouvert.
const ONGLET = "if(location.hash)document.documentElement.classList.add('onglet-a-rouvrir');";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const nonce = h.get("x-nonce") ?? undefined;
  const settings = await getSettings();
  const surcharge = primaryCssOverride(settings.UI_PRIMARY_COLOR);
  return (
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script inline statique, sans donnée externe. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOT }} suppressHydrationWarning />
        <script
          nonce={nonce}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: script inline statique, sans donnée externe.
          dangerouslySetInnerHTML={{ __html: ONGLET }}
          suppressHydrationWarning
        />
        <link href="/vendor/bootstrap.min.css" rel="stylesheet" />
        <link href="/vendor/bootstrap-icons.css" rel="stylesheet" />
        <link href="/vendor/fonts/ibm-plex.css" rel="stylesheet" />
        {/* La feuille de Sentinelle après Bootstrap, comme dans base.html : elle le surcharge. */}
        <link href={`/css/sentinelle.css?v=${CSS_VERSION}`} rel="stylesheet" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS calculée côté serveur depuis une couleur validée (#rrggbb). */}
        {surcharge ? <style dangerouslySetInnerHTML={{ __html: surcharge }} /> : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
