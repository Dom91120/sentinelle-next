/** Bilan PDF de la météo DSI (port de app/pdf_report.py), pour comité de pilotage. */
import { STATUS_LABELS } from "@/lib/libelles";
import { certificateLabel } from "@/lib/statuts";
import { adminRoleNames } from "@/modules/users/server";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { chargerTout, type Tout } from "@/server/donnees";
import { type CurrentUser, loadUser } from "@/server/guards";
import { escapeHtml, sendEmail } from "@/server/mailer";
import { htmlVersPdf } from "@/server/pdf";

const INDIGO = "#4f46e5";
const STATUS_COLOR: Record<string, string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  success: "#10b981",
};

type Cat = { key: string; label: string; items: (tout: Tout) => { status: string; nom: string }[] };
const CATS: Cat[] = [
  {
    key: "accounts",
    label: "Comptes",
    items: (t) =>
      t.accounts.map((o) => ({ status: o.status, nom: `${o.serviceName} (${o.username})` })),
  },
  {
    key: "certificates",
    label: "Certificats",
    items: (t) => t.certificates.map((o) => ({ status: o.status, nom: certificateLabel(o) })),
  },
  {
    key: "domains",
    label: "Domaines",
    items: (t) => t.domains.map((o) => ({ status: o.status, nom: o.name })),
  },
  {
    key: "backups",
    label: "Sauvegardes",
    items: (t) => t.backups.map((o) => ({ status: o.status, nom: o.serviceName })),
  },
  {
    key: "tests",
    label: "Tests",
    items: (t) => t.tests.map((o) => ({ status: o.status, nom: o.name })),
  },
  {
    key: "reviews",
    label: "Revue de droits",
    items: (t) => t.reviews.map((o) => ({ status: o.status, nom: o.application })),
  },
  {
    key: "updates",
    label: "Mises à jour",
    items: (t) => t.updates.map((o) => ({ status: o.status, nom: o.name })),
  },
];

function horodatage(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} à ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

export async function buildPdf(user: CurrentUser): Promise<Buffer> {
  const e = escapeHtml;
  const tout = await chargerTout();
  const totals = { total: 0, danger: 0, warning: 0, info: 0, success: 0 };
  const urgent: [string, string, string][] = [];
  let lignes = "";
  for (const cat of CATS) {
    if (!user.canView(cat.key)) continue;
    const items = cat.items(tout);
    const cnt: Record<string, number> = { danger: 0, warning: 0, info: 0, success: 0 };
    for (const o of items) {
      if (o.status in cnt) cnt[o.status] += 1;
      if (o.status === "danger" || o.status === "warning")
        urgent.push([cat.label, o.nom, o.status]);
    }
    lignes += `<tr><td>${e(cat.label)}</td><td>${items.length}</td><td>${cnt.danger}</td><td>${cnt.warning}</td><td>${cnt.info}</td><td>${cnt.success}</td></tr>`;
    totals.total += items.length;
    totals.danger += cnt.danger;
    totals.warning += cnt.warning;
    totals.info += cnt.info;
    totals.success += cnt.success;
  }
  const conformity = totals.total ? Math.round((100 * totals.success) / totals.total) : 100;
  urgent.sort((a, b) => (a[2] === "danger" ? 0 : 1) - (b[2] === "danger" ? 0 : 1));
  const aTraiter = urgent.length
    ? `<table class="urgent"><thead><tr><th>Statut</th><th>Catégorie</th><th>Élément</th></tr></thead><tbody>${urgent
        .map(
          ([label, nom, s]) =>
            `<tr><td style="color:${STATUS_COLOR[s]}">${e(STATUS_LABELS[s] ?? s)}</td><td>${e(label)}</td><td>${e(nom)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "<p>Aucun élément critique ni urgent. ✓</p>";
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
body{font-family:Helvetica,Arial,sans-serif;color:#000;font-size:10pt;margin:0}
h1{color:${INDIGO};font-size:20pt;margin:0 0 4pt;text-align:center}
h2{color:#1e293b;font-size:14pt;margin:12pt 0 6pt}
.small{color:#808080;font-size:9pt;margin:0;text-align:center}
table{border-collapse:collapse;font-size:9pt}
table.synthese th{background:${INDIGO};color:#fff;padding:5pt;border:0.5pt solid #e2e8f0;text-align:center}
table.synthese td{padding:5pt;border:0.5pt solid #e2e8f0;text-align:center}
table.synthese td:first-child,table.synthese th:first-child{text-align:left}
table.synthese tbody tr:nth-child(even) td{background:#f8fafc}
table.urgent th{background:#1e293b;color:#fff;padding:4pt;border:0.5pt solid #e2e8f0;text-align:left}
table.urgent td{padding:4pt;border:0.5pt solid #e2e8f0}
table.urgent td:nth-child(1){width:2.5cm}table.urgent td:nth-child(2){width:3.5cm}table.urgent td:nth-child(3){width:10cm}
</style></head><body>
<h1>Sentinelle — Bilan de supervision DSI</h1>
<p class="small">Généré le ${horodatage()}</p>
<h2>Conformité globale : <b>${conformity}%</b> (${totals.success} OK / ${totals.total} éléments suivis)</h2>
<table class="synthese"><thead><tr><th>Catégorie</th><th>Total</th><th>${e(STATUS_LABELS.danger)}</th><th>${e(STATUS_LABELS.warning)}</th><th>${e(STATUS_LABELS.info)}</th><th>${e(STATUS_LABELS.success)}</th></tr></thead><tbody>${lignes}</tbody></table>
<h2>Éléments à traiter</h2>
${aTraiter}
</body></html>`;
  return htmlVersPdf(html, { top: "1.5cm", right: "1.5cm", bottom: "1.5cm", left: "1.5cm" });
}

/** Génère le bilan PDF et l'envoie par mail (tâche planifiée ou bouton « Envoyer maintenant »). Retourne les destinataires. */
export async function sendReport(cfgIn?: AppSettings, recipientsIn?: string[]): Promise<string[]> {
  const cfg = cfgIn ?? (await getSettings());
  const recipients = (
    recipientsIn?.length
      ? recipientsIn
      : cfg.REPORT_RECIPIENTS?.length
        ? cfg.REPORT_RECIPIENTS
        : (cfg.ALERT_RECIPIENTS ?? [])
  )
    .map((r) => r.trim())
    .filter(Boolean);
  if (!recipients.length) throw new Error("Aucun destinataire configure pour le bilan PDF.");
  // Vision complète : le rapport planifié est généré avec les droits admin.
  const noms = await adminRoleNames();
  const adminRow = await prisma.user.findFirst({
    where: { role: { in: [...noms] } },
    orderBy: { createdAt: "asc" },
  });
  const admin = adminRow ? await loadUser(adminRow.id) : null;
  if (!admin) throw new Error("Aucun compte administrateur trouve.");
  const pdf = await buildPdf(admin);
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${p(now.getUTCDate())}/${p(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
  const fichier = `sentinelle-bilan-${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}.pdf`;
  await sendEmail(
    `Bilan de supervision DSI du ${stamp}`,
    recipients,
    `Veuillez trouver ci-joint le bilan de supervision Sentinelle genere le ${stamp}.\n\nCe message est envoye automatiquement.`,
    null,
    [{ filename: fichier, content: pdf, contentType: "application/pdf" }],
    cfg,
  );
  return recipients;
}
