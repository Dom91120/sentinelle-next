/** Export PDF par entité (port de app/pdf_entity.py) : preuve d'audit pour une fiche individuelle. */
import { dateHeure, STATUS_LABELS } from "@/lib/libelles";
import { escapeHtml } from "@/server/mailer";
import { htmlVersPdf } from "@/server/pdf";

const BLUE = "#3056a0";
const LIGHT = "#f5f6f8";
const STATUS_COLOR: Record<string, string> = {
  danger: "#dc2626",
  warning: "#d97706",
  info: "#2563eb",
  success: "#16a34a",
};

export type LigneHistorique = {
  performedAt: Date | null;
  action: string | null;
  performedBy: string | null;
  comment: string | null;
};

function horodatage(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} à ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Construit un PDF générique à partir d'une liste de (libellé, valeur). */
export async function construirePdfFiche(
  title: string,
  subtitle: string,
  rows: [string, string | null | undefined][],
  status?: string | null,
  history?: LigneHistorique[],
): Promise<Buffer> {
  const e = escapeHtml;
  let corps = `<h1>Sentinelle — Fiche d'audit</h1><p class="small">Généré le ${horodatage()} UTC</p>`;
  if (status) {
    const sc = STATUS_COLOR[status] ?? "#808080";
    corps += `<p class="body" style="margin-top:8px"><span style="color:${sc}">●</span> Statut : <b>${e(STATUS_LABELS[status] ?? status)}</b></p>`;
  }
  corps += `<h2>${e(title)}</h2>`;
  if (subtitle) corps += `<p class="small">${e(subtitle)}</p>`;
  if (rows.length) {
    corps += `<table class="fiche">${rows.map(([k, v]) => `<tr><th>${e(String(k))}</th><td>${e(v === null || v === undefined ? "—" : String(v))}</td></tr>`).join("")}</table>`;
  }
  if (history?.length) {
    corps += `<h2 style="margin-top:14pt">Historique récent</h2><table class="histo"><thead><tr><th>Date</th><th>Action</th><th>Par</th><th>Commentaire</th></tr></thead><tbody>`;
    for (const h of history.slice(0, 20)) {
      corps += `<tr><td>${h.performedAt ? e(dateHeure(h.performedAt)) : "—"}</td><td>${e(h.action || "—")}</td><td>${e(h.performedBy || "—")}</td><td>${e(h.comment || "—")}</td></tr>`;
    }
    corps += "</tbody></table>";
  }
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
body{font-family:Helvetica,Arial,sans-serif;color:#000;font-size:10pt;margin:0}
h1{color:${BLUE};font-size:18pt;margin:0 0 4pt;text-align:center}
h2{color:#1e293b;font-size:12pt;margin:14pt 0 4pt}
.small{color:#808080;font-size:8pt;margin:0}
.body{font-size:10pt}
table{border-collapse:collapse;width:100%;margin-top:8pt}
table.fiche th,table.fiche td{border:0.3pt solid #e2e8f0;padding:5pt 8pt;font-size:9pt;text-align:left;vertical-align:top}
table.fiche th{background:${LIGHT};font-weight:bold;width:5cm}
table.fiche tr:nth-child(even) td{background:${LIGHT}}
table.histo th{background:${BLUE};color:#fff;font-weight:bold;font-size:8pt;padding:4pt 6pt;text-align:left;border:0.3pt solid #e2e8f0}
table.histo td{font-size:8pt;padding:4pt 6pt;border:0.3pt solid #e2e8f0;vertical-align:top}
table.histo tbody tr:nth-child(even) td{background:${LIGHT}}
</style></head><body>${corps}</body></html>`;
  return htmlVersPdf(html);
}
