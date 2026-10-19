/**
 * Fin de support (End-of-Life) des OS via https://endoflife.date — port de app/eol.py.
 * Les données sont mises en cache en base (table eol_cache) ; le réseau n'est
 * sollicité qu'au rafraîchissement (bouton ou tâche planifiée), jamais au rendu.
 */
import type { Statut } from "@/lib/constantes";
import { aujourdhui, diffJours } from "@/lib/libelles";
import { prisma } from "@/server/db";
import { journal } from "@/server/log";

/** Mot-clé (dans le champ OS, en minuscules) → produit endoflife.date. Les plus spécifiques d'abord. */
export const PRODUCT_MAP: [string, string][] = [
  ["windows server", "windows-server"],
  ["windows", "windows"],
  ["ubuntu", "ubuntu"],
  ["debian", "debian"],
  ["rocky", "rocky-linux"],
  ["almalinux", "almalinux"],
  ["alma", "almalinux"],
  ["centos", "centos"],
  ["red hat", "rhel"],
  ["rhel", "rhel"],
  ["opensuse", "opensuse"],
  ["sles", "sles"],
  ["suse", "sles"],
  ["fedora", "fedora"],
  ["oracle linux", "oracle-linux"],
];

export const PRODUCTS = [...new Set(PRODUCT_MAP.map(([, slug]) => slug))].sort();

const API = (p: string) => `https://endoflife.date/api/${p}.json`;

export type Cycle = { cycle?: string | number; eol?: boolean | string; [k: string]: unknown };
export type EolInfo = {
  product: string;
  cycle: string | null;
  eol_date: Date | null;
  status: Statut | null;
  days_left: number | null;
  has_data: boolean;
};

async function fetchOne(product: string, timeoutMs = 15_000): Promise<boolean> {
  let payload: string;
  try {
    const r = await fetch(API(product), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) {
      journal.avert("eol", "HTTP", { product, statut: r.status });
      return false;
    }
    payload = await r.text();
    JSON.parse(payload);
  } catch (e) {
    journal.avert("eol", "échec récupération", { product, erreur: e });
    return false;
  }
  await prisma.eolCache.upsert({
    where: { product },
    update: { payload, fetchedAt: new Date() },
    create: { product, payload, fetchedAt: new Date() },
  });
  return true;
}

/** Rafraîchit tous les produits. Retourne [ok, total]. */
export async function refreshAll(): Promise<[number, number]> {
  let ok = 0;
  for (const p of PRODUCTS) if (await fetchOne(p)) ok += 1;
  return [ok, PRODUCTS.length];
}

export type CyclesParProduit = Map<string, Cycle[] | null>;

/** Charge d'un coup tous les cycles en cache (une requête par rendu de liste). */
export async function chargerCycles(): Promise<CyclesParProduit> {
  const out: CyclesParProduit = new Map();
  try {
    const rows = await prisma.eolCache.findMany();
    for (const row of rows) {
      try {
        out.set(row.product, row.payload ? (JSON.parse(row.payload) as Cycle[]) : null);
      } catch {
        out.set(row.product, null);
      }
    }
  } catch (e) {
    journal.avert("eol", "cache illisible", { erreur: e });
  }
  return out;
}

function productFor(text: string): string | null {
  for (const [kw, slug] of PRODUCT_MAP) if (text.includes(kw)) return slug;
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Le cycle dont l'identifiant apparaît dans le texte (le plus long, avec limites de mot). */
export function matchCycle(cycles: Cycle[], text: string): Cycle | null {
  let best: Cycle | null = null;
  for (const c of cycles) {
    const cyc = String(c.cycle ?? "").trim();
    if (!cyc) continue;
    const re = new RegExp(`(?<![\\w.])${escapeRe(cyc)}(?![\\w.])`);
    if (re.test(text)) {
      if (best === null || cyc.length > String(best.cycle ?? "").length) best = c;
    }
  }
  return best;
}

function statusOf(eol: unknown, today = aujourdhui()): [Date | null, Statut | null, number | null] {
  if (eol === false) return [null, "success", null];
  if (eol === true) return [null, "danger", null];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(eol ?? ""));
  if (!m) return [null, null, null];
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const days = diffJours(d, today);
  if (days < 0) return [d, "danger", days];
  if (days <= 180) return [d, "warning", days];
  return [d, "success", days];
}

/** Infos EOL d'un OS d'après les cycles en cache, ou null si non reconnu. */
export function lookupDans(
  cycles: CyclesParProduit,
  os: string | null | undefined,
  version?: string | null,
  today = aujourdhui(),
): EolInfo | null {
  const text = `${os ?? ""} ${version ?? ""}`.trim().toLowerCase();
  if (!text) return null;
  const product = productFor(text);
  if (!product) return null;
  const data = cycles.get(product) ?? null;
  if (data === null) {
    return { product, cycle: null, eol_date: null, status: null, days_left: null, has_data: false };
  }
  const cyc = matchCycle(data, text);
  if (!cyc) return { product, cycle: null, eol_date: null, status: null, days_left: null, has_data: true };
  const [eolDate, status, days] = statusOf(cyc.eol, today);
  return { product, cycle: cyc.cycle != null ? String(cyc.cycle) : null, eol_date: eolDate, status, days_left: days, has_data: true };
}

/** `eol.lookup(os, version)` : charge le cache puis cherche. */
export async function lookup(os: string | null | undefined, version?: string | null): Promise<EolInfo | null> {
  return lookupDans(await chargerCycles(), os, version);
}
