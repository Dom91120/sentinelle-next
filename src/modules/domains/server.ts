/** Domaines (port de app/domains.py, domain_checker.py, ct_checker.py, ct_monitor.py). */
import type { CtLogEntry, Domain } from "@/generated/prisma/client";
import { champ, coche, parseDate, parseInt_ } from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { domainForHost } from "@/lib/statuts";
import { sendAlert } from "@/server/alerts";
import { getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { isSnoozed } from "@/server/snooze";

// ── RDAP (domain_checker.py) ──

const RDAP_BOOTSTRAP = "https://rdap.org/domain/";

function cleanDomainRdap(value: string | null | undefined): string {
  let v = (value ?? "").trim().toLowerCase();
  if (v.includes("://")) v = v.split("://", 2)[1];
  return v.split("/", 1)[0];
}

/** La date UTC (minuit) d'un horodatage RDAP ; null si illisible. */
function dateUtc(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const dt = new Date(value.replace("Z", "+00:00"));
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

export type DomainInfo = {
  expiryDate: Date | null;
  renewedOn: Date | null;
  registrar: string | null;
};

function vcardName(entity: Record<string, unknown>): string | null {
  try {
    const vcard = (entity.vcardArray as unknown[])?.[1] as unknown[][] | undefined;
    for (const item of vcard ?? []) if (item?.[0] === "fn") return String(item[3]);
  } catch {
    /* jCard illisible */
  }
  return null;
}

/** Lit l'expiration, le dernier renouvellement et le registrar d'un domaine au registre (RDAP). */
export async function fetchDomainInfo(
  domain: string,
  timeoutMs = 15_000,
  fetcher: typeof fetch = fetch,
): Promise<DomainInfo> {
  const name = cleanDomainRdap(domain);
  if (!name) throw new Error("Domaine vide");
  const resp = await fetcher(RDAP_BOOTSTRAP + name, {
    headers: { Accept: "application/rdap+json" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (resp.status === 404) throw new Error("Domaine introuvable dans le RDAP");
  if (resp.status !== 200) throw new Error(`RDAP a repondu HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    events?: { eventAction?: string; eventDate?: string }[];
    entities?: Record<string, unknown>[];
  };
  let expiry: Date | null = null;
  let changed: Date | null = null;
  let registration: Date | null = null;
  for (const event of data.events ?? []) {
    const action = event.eventAction;
    if (!action || !["expiration", "expiry", "last changed", "registration"].includes(action))
      continue;
    const d = dateUtc(event.eventDate);
    if (!d) continue;
    if (action === "expiration" || action === "expiry") expiry = expiry ?? d;
    else if (action === "last changed") changed = d;
    else registration = d;
  }
  let renewedOn = changed ?? registration;
  if (renewedOn && expiry && renewedOn.getTime() >= expiry.getTime()) renewedOn = null;
  let registrar: string | null = null;
  for (const ent of data.entities ?? []) {
    const roles = (ent.roles as string[] | undefined) ?? [];
    if (roles.includes("registrar")) {
      registrar = vcardName(ent) ?? registrar;
      break;
    }
  }
  return { expiryDate: expiry, renewedOn, registrar };
}

// ── Certificate Transparency (ct_checker.py) ──

const CRTSH_URL = "https://crt.sh/";

function cleanDomainCt(value: string | null | undefined): string {
  let v = (value ?? "").trim().toLowerCase();
  if (v.includes("://")) v = v.split("://", 2)[1];
  v = v.split("/", 1)[0].split(":", 1)[0];
  return v.replace(/^\*+/, "").replace(/^\.+/, "");
}

/** crt.sh renvoie des dates ISO sans fuseau : on les considère en UTC. */
function parseDt(value: unknown): Date | null {
  if (!value) return null;
  const dt = new Date(`${String(value).replace("Z", "")}Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseJour(value: unknown): Date | null {
  const dt = parseDt(value);
  return dt ? new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())) : null;
}

export type CtCert = {
  crtshId: number;
  serialNumber: string | null;
  commonName: string | null;
  nameValue: string;
  issuerName: string | null;
  notBefore: Date | null;
  notAfter: Date | null;
  entryTimestamp: Date | null;
};

function normalize(row: Record<string, unknown>): CtCert | null {
  const cid = Number.parseInt(String(row?.id ?? ""), 10);
  if (!Number.isInteger(cid)) return null;
  const s = (v: unknown, n: number) =>
    String(v ?? "").slice(0, n) ? String(v ?? "").slice(0, n) : null;
  return {
    crtshId: cid,
    serialNumber: s(row.serial_number, 128),
    commonName: s(row.common_name, 256),
    nameValue: String(row.name_value ?? ""),
    issuerName: s(row.issuer_name, 256),
    notBefore: parseJour(row.not_before),
    notAfter: parseJour(row.not_after),
    entryTimestamp: parseDt(row.entry_timestamp),
  };
}

/** Les certificats connus de crt.sh pour le domaine et ses sous-domaines, triés par id croissant. */
export async function fetchCtCertificates(
  domain: string,
  timeoutMs = 25_000,
  fetcher: typeof fetch = fetch,
): Promise<CtCert[]> {
  const name = cleanDomainCt(domain);
  if (!name) throw new Error("Domaine vide");
  const url = `${CRTSH_URL}?q=${encodeURIComponent(name)}&output=json`;
  const resp = await fetcher(url, {
    headers: { "User-Agent": "Sentinelle-CT/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (resp.status !== 200) throw new Error(`crt.sh a repondu HTTP ${resp.status}`);
  const texte = await resp.text();
  let rows: Record<string, unknown>[];
  try {
    rows = JSON.parse(texte);
  } catch {
    if (!texte.trim()) return [];
    throw new Error("Reponse crt.sh illisible (JSON attendu)");
  }
  const byId = new Map<number, CtCert>();
  for (const row of rows ?? []) {
    const cert = normalize(row);
    if (cert) byId.set(cert.crtshId, cert);
  }
  return [...byId.keys()].sort((a, b) => a - b).map((k) => byId.get(k) as CtCert);
}

/** `CtLogEntry.sans()` : les noms (SAN) du certificat, dédupliqués. */
export function sans(e: { nameValue: string | null }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const brut of (e.nameValue ?? "").split(/\r?\n/)) {
    const s = brut.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

// ── Surveillance CT (ct_monitor.py) ──

export type ScanResult = { baseline: number; new: CtLogEntry[]; error: string | null };

async function persist(domainId: number, cert: CtCert, status: string): Promise<CtLogEntry> {
  return prisma.ctLogEntry.create({
    data: {
      domainId,
      crtshId: BigInt(cert.crtshId),
      serialNumber: cert.serialNumber,
      commonName: cert.commonName,
      nameValue: cert.nameValue,
      issuerName: cert.issuerName,
      notBefore: cert.notBefore,
      notAfter: cert.notAfter,
      entryTimestamp: cert.entryTimestamp,
      status,
    },
  });
}

/** Scanne crt.sh pour un domaine, enregistre les certificats et alerte sur les nouveaux. */
export async function scanDomain(
  domain: Domain,
  performedBy = "auto-ct",
  fetcher: (name: string) => Promise<CtCert[]> = fetchCtCertificates,
  doAlert = true,
): Promise<ScanResult> {
  let certs: CtCert[];
  try {
    certs = await fetcher(domain.name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.domainHistory.create({
      data: {
        domainId: domain.id,
        action: "ct_scan_failed",
        comment: `Scan CT impossible : ${msg}`,
        performedBy,
      },
    });
    return { baseline: 0, new: [], error: msg };
  }
  const connus = await prisma.ctLogEntry.findMany({
    where: { domainId: domain.id },
    select: { crtshId: true },
  });
  const known = new Set(connus.map((r) => Number(r.crtshId)));
  const fresh = certs.filter((c) => !known.has(c.crtshId));
  const maxId = certs.length ? Math.max(...certs.map((c) => c.crtshId)) : null;

  // Premier scan : ligne de base silencieuse, on n'alerte pas sur l'historique.
  if (domain.ctLastId === null || domain.ctLastId === undefined) {
    for (const c of fresh) await persist(domain.id, c, "baseline");
    await prisma.domain.update({
      where: { id: domain.id },
      data: { ctLastId: maxId === null ? null : BigInt(maxId) },
    });
    await prisma.domainHistory.create({
      data: {
        domainId: domain.id,
        action: "ct_baseline",
        comment: `Ligne de base CT etablie : ${fresh.length} certificat(s) connu(s).`,
        performedBy,
      },
    });
    return { baseline: fresh.length, new: [], error: null };
  }

  const newEntries: CtLogEntry[] = [];
  for (const c of fresh) newEntries.push(await persist(domain.id, c, "new"));
  if (maxId !== null) {
    const courant = Number(domain.ctLastId ?? 0);
    await prisma.domain.update({
      where: { id: domain.id },
      data: { ctLastId: BigInt(Math.max(courant, maxId)) },
    });
  }
  if (fresh.length) {
    await prisma.domainHistory.create({
      data: {
        domainId: domain.id,
        action: "ct_new_cert",
        comment: `${fresh.length} nouveau(x) certificat(s) detecte(s) dans les journaux CT.`,
        performedBy,
      },
    });
  }
  if (doAlert && newEntries.length && !(await isSnoozed("domain", domain.id)))
    await alerteCt(domain, newEntries);
  return { baseline: 0, new: newEntries, error: null };
}

async function alerteCt(domain: Domain, entries: CtLogEntry[]): Promise<void> {
  const lines: string[] = [];
  for (const e of entries.slice(0, 20)) {
    const names = sans(e).slice(0, 5).join(", ") || e.commonName || "(sans nom)";
    const nb = e.notBefore ? dateCourte(e.notBefore) : "?";
    lines.push(`- ${names}\n    Emetteur : ${e.issuerName || "?"} | emis le ${nb}`);
  }
  const extra = entries.length > 20 ? `\n(+ ${entries.length - 20} autre(s) certificat(s))` : "";
  const body =
    `${entries.length} nouveau(x) certificat(s) ont ete emis pour le domaine ${domain.name} (ou un sous-domaine) et publies dans les journaux de Certificate Transparency.\n\n` +
    `Verifiez leur legitimite (nouveau service, prestataire, ou emission frauduleuse) :\n\n${lines.join("\n")}${extra}\n`;
  await sendAlert(
    `Certificats CT inconnus - ${domain.name}`,
    body,
    "ct",
    domain.id,
    domain.name,
    "warning",
  );
}

/** Scanne tous les domaines actifs dont la surveillance CT est activée. */
export async function runCtScan(): Promise<void> {
  const cfg = await getSettings();
  if (!cfg.CT_MONITORING) return;
  for (const domain of await prisma.domain.findMany({ where: { isActive: true } })) {
    if (!domain.ctEnabled) continue;
    try {
      await scanDomain(domain);
    } catch (e) {
      console.error("[ct] scan échoué :", e);
    }
  }
}

// ── Fiche (domains.py) ──

export async function formContext() {
  return {
    suppliers: await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

/** La fiche fournisseur que désigne ce nom (casse ignorée, deux homonymes actifs : aucune). */
export async function fournisseurParNom(
  nom: string | null | undefined,
): Promise<{ id: number; name: string } | null> {
  if (!nom?.trim()) return null;
  const candidats = await prisma.supplier.findMany({
    where: { isActive: true, name: { equals: nom.trim(), mode: "insensitive" } },
    select: { id: true, name: true },
  });
  return candidats.length === 1 ? candidats[0] : null;
}

/** (texte, registrar_id) depuis le formulaire : la fiche choisie prime, sinon le texte cherche sa fiche par nom. */
export async function registrarDepuis(f: FormData): Promise<[string | null, number | null]> {
  let texte: string | null = champ(f, "registrar") || null;
  const choisi = parseInt_(f.get("registrar_id"), null);
  let fiche: { id: number; name: string; isActive: boolean } | null = choisi
    ? await prisma.supplier.findUnique({
        where: { id: choisi },
        select: { id: true, name: true, isActive: true },
      })
    : null;
  if (!fiche?.isActive) {
    const parNom = await fournisseurParNom(texte);
    fiche = parNom ? { ...parNom, isActive: true } : null;
  }
  if (fiche && !texte) texte = fiche.name;
  return [texte, fiche ? fiche.id : null];
}

/** Les champs d'un domaine depuis le formulaire (hors nom, validé à part). */
export async function depuisFormulaire(f: FormData) {
  const [registrar, registrarId] = await registrarDepuis(f);
  return {
    registrar,
    registrarId,
    expiryDate: parseDate(f.get("expiry_date")),
    renewedOn: parseDate(f.get("renewed_on")),
    autoRenew: coche(f, "auto_renew"),
    description: typeof f.get("description") === "string" ? (f.get("description") as string) : null,
  };
}

/** `Domain.rattacher_certificats()` : relie les certificats TLS sans domaine dont le nom d'hôte relève de cette fiche. */
export async function rattacherCertificats(domainId: number): Promise<number> {
  const domaines = await prisma.domain.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const certs = await prisma.certificate.findMany({
    where: { kind: "tls", domainId: null, domain: { not: null } },
    select: { id: true, domain: true },
  });
  let n = 0;
  for (const c of certs) {
    if (domainForHost(c.domain, domaines)?.id === domainId) {
      await prisma.certificate.update({ where: { id: c.id }, data: { domainId } });
      n += 1;
    }
  }
  return n;
}

/** Met à jour la fiche depuis le RDAP, avec historique. Retourne (ok, message). */
export async function refreshDomainRdap(
  domain: Domain,
  performedBy: string,
  fetcher: (name: string) => Promise<DomainInfo> = fetchDomainInfo,
): Promise<[boolean, string]> {
  let info: DomainInfo;
  try {
    info = await fetcher(domain.name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.domainHistory.create({
      data: {
        domainId: domain.id,
        action: "rdap_check_failed",
        comment: `Echec RDAP : ${msg}`,
        performedBy,
      },
    });
    return [false, `Verification RDAP impossible : ${msg}`];
  }
  if (!info.expiryDate) {
    await prisma.domainHistory.create({
      data: {
        domainId: domain.id,
        action: "rdap_check",
        comment: "RDAP n'a pas fourni de date d'expiration",
        performedBy,
      },
    });
    return [false, "Le RDAP n'a pas fourni de date d'expiration pour ce domaine."];
  }
  const old = domain.expiryDate;
  const data: {
    expiryDate: Date;
    renewedOn?: Date;
    registrar?: string;
    registrarId?: number | null;
  } = { expiryDate: info.expiryDate };
  if (info.renewedOn) data.renewedOn = info.renewedOn;
  if (info.registrar) {
    data.registrar = info.registrar;
    if (domain.registrarId === null) {
      const fiche = await fournisseurParNom(info.registrar);
      data.registrarId = fiche ? fiche.id : null;
    }
  }
  await prisma.domain.update({ where: { id: domain.id }, data });
  let msg = `Expiration mise a jour via RDAP : ${dateCourte(info.expiryDate)}`;
  if (old && old.getTime() !== info.expiryDate.getTime()) msg += ` (avant : ${dateCourte(old)})`;
  await prisma.domainHistory.create({
    data: { domainId: domain.id, action: "rdap_check", comment: msg, performedBy },
  });
  return [true, msg];
}
