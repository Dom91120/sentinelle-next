/** Les échéances de l'agenda (port de dashboard._agenda_items) : partagé par la page Agenda et le flux ICS. */
import { aujourdhui, diffJours } from "@/lib/libelles";
import { certificateLabel, certificateMonitored, contractActionDeadline } from "@/lib/statuts";
import { prisma } from "@/server/db";
import { chargerCycles, lookupDans } from "@/server/eol";
import type { CurrentUser } from "@/server/guards";

export type Echeance = { cat: string; icon: string; name: string; date: Date; days: number; detail: string; url: string };

export async function agendaItems(user: CurrentUser): Promise<[Date, Echeance[]]> {
  const today = aujourdhui();
  const items: Echeance[] = [];
  const add = (cat: string, icon: string, name: string, date: Date | null | undefined, detail: string, url: string) => {
    if (!date) return;
    items.push({ cat, icon, name, date, days: diffJours(date, today), detail, url });
  };
  if (user.canView("accounts")) {
    for (const a of await prisma.account.findMany({ where: { isActive: true } })) add("Comptes", "key", `${a.serviceName} (${a.username})`, a.nextPasswordChange, "Rotation du mot de passe", `/accounts/${a.id}`);
  }
  if (user.canView("certificates")) {
    for (const c of await prisma.certificate.findMany({ where: { isActive: true } })) {
      if (!certificateMonitored(c)) continue;
      add("Certificats", "award", certificateLabel(c), c.expiryDate, "Expiration du certificat", `/certificates/${c.id}`);
    }
  }
  if (user.canView("domains")) {
    for (const d of await prisma.domain.findMany({ where: { isActive: true } })) add("Domaines", "globe", d.name, d.expiryDate, "Expiration du domaine", `/domains/${d.id}`);
  }
  if (user.canView("tests")) {
    for (const t of await prisma.testTask.findMany({ where: { isActive: true } })) add("Tests", "clipboard-check", t.name, t.nextDue, "Test a effectuer", `/tests/${t.id}`);
  }
  if (user.canView("reviews")) {
    for (const r of await prisma.accessReview.findMany({ where: { isActive: true } })) add("Revue de droits", "person-check", r.application, r.nextReview, "Revue des acces", `/reviews/${r.id}`);
  }
  if (user.canView("contracts")) {
    for (const c of await prisma.contract.findMany({ where: { isActive: true } })) add("Contrats", "file-earmark-text", c.name, contractActionDeadline(c), "Échéance / préavis du contrat", `/contracts/${c.id}`);
  }
  if (user.canView("inventory")) {
    const cycles = await chargerCycles();
    for (const e of await prisma.equipment.findMany({ where: { isActive: true } })) {
      add("Matériel", "hdd-stack", `${e.name} (garantie)`, e.warrantyEnd, "Fin de garantie matérielle", `/inventory/${e.id}`);
      const ei = lookupDans(cycles, e.os, e.osVersion);
      if (ei?.eol_date) add("Matériel", "hdd-stack", `${e.name} (fin de support OS)`, ei.eol_date, "Fin de support de l'OS", `/inventory/${e.id}`);
    }
  }
  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  return [today, items];
}

function esc(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** RFC 5545 : lignes longues repliées (continuation = espace en tête). */
function fold(line: string): string[] {
  const out: string[] = [];
  let reste = line;
  while (reste.length > 70) {
    out.push(reste.slice(0, 70));
    reste = ` ${reste.slice(70)}`;
  }
  out.push(reste);
  return out;
}

function jour(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Le flux iCalendar des échéances. */
export function construireIcs(items: Echeance[], base: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sentinelle//Agenda//FR", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Sentinelle - Échéances", "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H"];
  for (const it of items) {
    const uid = `sentinelle-${it.url.replace(/^\/+|\/+$/g, "").replace(/\//g, "-")}@sentinelle`;
    const ev = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${jour(it.date)}`, `SUMMARY:${esc(`[${it.cat}] ${it.name}`)}`, `DESCRIPTION:${esc(it.detail)}`];
    if (base) ev.push(`URL:${base}${it.url}`);
    ev.push("END:VEVENT");
    for (const line of ev) lines.push(...fold(line));
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
