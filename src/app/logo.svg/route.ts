import { readFile } from "node:fs/promises";
import path from "node:path";
import { tintedLogoSvg } from "@/lib/theming";
import { getSettings } from "@/server/config-store";

/** /logo.svg (auth.logo) : logo teinté avec la couleur du site si définie. Public. */
export async function GET() {
  const svg = await readFile(path.join(process.cwd(), "public", "img", "logo.svg"), "utf8");
  const settings = await getSettings();
  return new Response(tintedLogoSvg(svg, settings.UI_PRIMARY_COLOR), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-cache" },
  });
}
