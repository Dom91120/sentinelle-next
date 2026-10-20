/**
 * Rendu PDF (HTML → PDF par Chromium headless, via Puppeteer). Remplace ReportLab :
 * les gabarits sont du HTML, la mise en page du CSS, le navigateur fait le reste.
 */
import puppeteer, { type Browser } from "puppeteer";

let navigateur: Promise<Browser> | null = null;

async function obtenirNavigateur(): Promise<Browser> {
  if (!navigateur) {
    navigateur = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    navigateur.catch(() => {
      navigateur = null;
    });
  }
  const b = await navigateur;
  if (!b.connected) {
    navigateur = null;
    return obtenirNavigateur();
  }
  return b;
}

export type MargesPdf = { top: string; right: string; bottom: string; left: string };

/** Un document HTML complet → les octets du PDF (A4, portrait). */
export async function htmlVersPdf(
  html: string,
  marges: MargesPdf = { top: "2cm", right: "2cm", bottom: "2cm", left: "2cm" },
): Promise<Buffer> {
  const b = await obtenirNavigateur();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: marges,
      preferCSSPageSize: false,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Réponse HTTP d'un PDF en pièce jointe (`send_file(..., as_attachment=True)`). */
export function reponsePdf(octets: Buffer, filename: string): Response {
  return new Response(new Uint8Array(octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(octets.length),
    },
  });
}
