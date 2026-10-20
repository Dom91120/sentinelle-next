/** Construit le récapitulatif quotidien de la météo DSI, un seul email (port de app/digest.py). */
import { aujourdhui, dateCourte, STATUS_LABELS } from "@/lib/libelles";
import {
  backupLastOkCheck,
  certificateLabel,
  certificateMonitored,
  contractActionDeadline,
} from "@/lib/statuts";
import { FREQ_LABELS_LOWER } from "@/modules/backups/server";
import { chargerTout } from "@/server/donnees";
import { enabledIn } from "@/server/features";
import { escapeHtml as e } from "@/server/mailer";
import { activeSnoozeKeys, snoozeKey } from "@/server/snooze";

const COLORS: Record<string, string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  success: "#10b981",
};
const LIST_PATHS: Record<string, string> = {
  Comptes: "/accounts/",
  Certificats: "/certificates/",
  Domaines: "/domains/",
  Sauvegardes: "/backups/",
  Tests: "/tests/",
  "Revue de droits": "/reviews/",
  "Mises a jour": "/updates/",
  Logiciels: "/inventory/logiciels/",
  Contrats: "/contracts/",
};

export type DigestItem = { name: string; detail: string; status: string; path: string };
export type DigestDomain = { key: string; total: number; items: DigestItem[]; path: string };

/** Les domaines avec compteurs et éléments non verts. */
export async function collect(): Promise<DigestDomain[]> {
  const today = aujourdhui();
  const tout = await chargerTout();
  const snoozed = await activeSnoozeKeys();
  const skip = (type: string, id: number) => snoozed.has(snoozeKey(type, id));
  const daysTxt = (d: Date | null | undefined, kind: "expire" | "due") => {
    if (!d) return "date non renseignee";
    const n = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    if (kind === "expire") return n >= 0 ? `expire dans ${n} j` : `expire depuis ${Math.abs(n)} j`;
    return n >= 0 ? `dans ${n} j` : `en retard de ${Math.abs(n)} j`;
  };
  const grave = (s: string) => s === "danger" || s === "warning";
  const domains: DigestDomain[] = [];
  const ajouter = (key: string, total: number, items: DigestItem[]) =>
    domains.push({ key, total, items, path: LIST_PATHS[key] ?? "" });

  ajouter(
    "Comptes",
    tout.accounts.length,
    tout.accounts
      .filter((a) => !skip("account", a.id) && grave(a.status))
      .map((a) => ({
        name: `${a.serviceName} (${a.username})`,
        detail: `Mot de passe ${daysTxt(a.nextPasswordChange, "expire")}`,
        status: a.status,
        path: `/accounts/${a.id}`,
      })),
  );
  if (enabledIn(tout.settings, "certificates")) {
    const certs = tout.certificates.filter((c) => certificateMonitored(c));
    ajouter(
      "Certificats",
      certs.length,
      certs
        .filter((c) => !skip("certificate", c.id) && grave(c.status))
        .map((c) => ({
          name: certificateLabel(c),
          detail: `Certificat ${daysTxt(c.expiryDate, "expire")}`,
          status: c.status,
          path: `/certificates/${c.id}`,
        })),
    );
  }
  ajouter(
    "Domaines",
    tout.domains.length,
    tout.domains
      .filter((d) => !skip("domain", d.id) && grave(d.status))
      .map((d) => ({
        name: d.name,
        detail: `Domaine ${daysTxt(d.expiryDate, "expire")}`,
        status: d.status,
        path: `/domains/${d.id}`,
      })),
  );
  ajouter(
    "Sauvegardes",
    tout.backups.length,
    tout.backups
      .filter((b) => !skip("backup", b.id) && grave(b.status))
      .map((b) => {
        const dernier = backupLastOkCheck(b.checks);
        const days = dernier
          ? Math.floor((today.getTime() - dernier.checkDate.getTime()) / 86_400_000)
          : null;
        const detail =
          days === null
            ? "Aucun backup OK enregistre"
            : `Dernier OK il y a ${days} j (${FREQ_LABELS_LOWER[b.frequency ?? ""] ?? (b.frequency ?? "").toLowerCase()})`;
        return { name: b.serviceName, detail, status: b.status, path: `/backups/${b.id}` };
      }),
  );
  ajouter(
    "Tests",
    tout.tests.length,
    tout.tests
      .filter((t) => !skip("test", t.id) && grave(t.status))
      .map((t) => ({
        name: t.name,
        detail: `Test ${daysTxt(t.nextDue, "due")}`,
        status: t.status,
        path: `/tests/${t.id}`,
      })),
  );
  ajouter(
    "Revue de droits",
    tout.reviews.length,
    tout.reviews
      .filter((r) => !skip("review", r.id) && grave(r.status))
      .map((r) => ({
        name: r.application,
        detail: `Revue ${daysTxt(r.nextReview, "due")}`,
        status: r.status,
        path: `/reviews/${r.id}`,
      })),
  );
  ajouter(
    "Mises a jour",
    tout.updates.length,
    tout.updates
      .filter((u) => !skip("update", u.id) && grave(u.status))
      .map((u) => ({
        name: u.name,
        detail: u.status === "danger" ? "Mise a jour critique" : "Mise a jour disponible",
        status: u.status,
        path: `/updates/${u.id}`,
      })),
  );
  ajouter(
    "Logiciels",
    tout.software.length,
    tout.software
      .filter((s) => !skip("software", s.id) && grave(s.status))
      .map((s) => ({
        name: s.name,
        detail:
          s.status === "danger"
            ? "Mise a jour critique en attente"
            : s.lifecycle === "fin_de_vie"
              ? "En fin de vie, successeur a trouver"
              : "Mise a jour disponible",
        status: s.status,
        path: `/inventory/logiciels/${s.id}`,
      })),
  );
  ajouter(
    "Contrats",
    tout.contracts.length,
    tout.contracts
      .filter((c) => !skip("contract", c.id) && grave(c.status))
      .map((c) => {
        const limite = contractActionDeadline(c);
        return {
          name: c.name,
          detail: `Agir avant le ${limite ? dateCourte(limite) : "?"}`,
          status: c.status,
          path: `/contracts/${c.id}`,
        };
      }),
  );
  return domains;
}

export type Digest = { subject: string; text: string; html: string; hasUrgent: boolean };

export async function buildDailyDigest(baseUrl = ""): Promise<Digest> {
  const base = (baseUrl || "").replace(/\/+$/, "");
  const domains = await collect();
  const today = dateCourte(new Date());
  const all = domains.flatMap((d) => d.items);
  const nDanger = all.filter((it) => it.status === "danger").length;
  const nWarning = all.filter((it) => it.status === "warning").length;
  const hasUrgent = all.length > 0;

  let subject: string;
  if (nDanger) subject = `Meteo DSI du ${today} - ${nDanger} critique(s), ${nWarning} urgent(s)`;
  else if (nWarning) subject = `Meteo DSI du ${today} - ${nWarning} urgent(s)`;
  else subject = `Meteo DSI du ${today} - tout est au vert`;

  const lines = [`Meteo DSI du ${today}`, ""];
  if (!hasUrgent) lines.push("Tout est au vert : aucun element critique ni urgent.");
  else {
    for (const d of domains) {
      if (!d.items.length) continue;
      lines.push(`== ${d.key} ==`);
      for (const it of d.items)
        lines.push(`  [${STATUS_LABELS[it.status]}] ${it.name} - ${it.detail}`);
      lines.push("");
    }
  }
  const text = lines.join("\n");

  let pills = "";
  for (const d of domains) {
    const nd = d.items.filter((it) => it.status === "danger").length;
    const nw = d.items.filter((it) => it.status === "warning").length;
    const color = nd ? COLORS.danger : nw ? COLORS.warning : COLORS.success;
    const badge = nd || nw ? `${nd + nw} a traiter` : "OK";
    let card =
      `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;">` +
      `<div style="font-size:12px;color:#64748b;">${e(d.key)}</div>` +
      `<div style="font-size:13px;font-weight:700;color:${color};margin-top:4px;">${badge}</div>` +
      `<div style="font-size:11px;color:#94a3b8;">${d.total} suivis</div></div>`;
    const link = base && d.path ? `${base}${d.path}` : null;
    if (link)
      card = `<a href="${e(link)}" style="text-decoration:none;color:inherit;display:block;">${card}</a>`;
    pills += `<td style="padding:6px;">${card}</td>`;
  }

  let blocks = "";
  if (!hasUrgent) {
    blocks = `<div style="padding:16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;color:#065f46;">Tout est au vert : aucun element critique ni urgent aujourd'hui.</div>`;
  } else {
    for (const d of domains) {
      if (!d.items.length) continue;
      let rows = "";
      for (const it of d.items) {
        const link = base ? `${base}${it.path}` : null;
        const nameCell = link
          ? `<a href="${e(link)}" style="color:#4f46e5;text-decoration:none;">${e(it.name)}</a>`
          : e(it.name);
        rows +=
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">` +
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COLORS[it.status]};margin-right:6px;"></span>${nameCell}</td>` +
          `<td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">${e(it.detail)}</td></tr>`;
      }
      blocks += `<h3 style="font-size:14px;color:#1e293b;margin:18px 0 6px;">${e(d.key)}</h3><table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>`;
    }
  }

  const cta = base
    ? `<div style="text-align:center;margin-top:18px;"><a href="${e(`${base}/`)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 22px;border-radius:8px;">Ouvrir Sentinelle</a></div>`
    : "";

  const html =
    '<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#334155;">' +
    '<div style="max-width:640px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">' +
    '<div style="background:linear-gradient(135deg,#6366f1,#3b82f6);padding:16px 24px;color:#fff;"><span style="font-size:18px;font-weight:700;">&#128737; Meteo DSI</span>' +
    `<span style="float:right;font-size:13px;opacity:.85;">${today}</span></div>` +
    '<div style="padding:20px 24px;">' +
    `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><tr>${pills}</tr></table>` +
    `<div style="margin-top:8px;">${blocks}</div>${cta}</div>` +
    '<div style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;">Recapitulatif automatique — Sentinelle, supervision DSI.</div>' +
    "</div></body></html>";

  return { subject, text, html, hasUrgent };
}
