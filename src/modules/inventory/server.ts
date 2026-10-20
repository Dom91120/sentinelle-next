/** Inventaire matériel (port de app/inventory.py et app/inventory_import.py). */
import type { Prisma } from "@/generated/prisma/client";
import {
  CRITICALITY_LABELS,
  EQUIPMENT_FAMILIES,
  EQUIPMENT_KIND_LABELS,
  equipmentFamily,
} from "@/lib/constantes";
import { parseDate, parseFloat_, parseInt_ } from "@/lib/forms-util";
import { prisma } from "@/server/db";

export const KIND_CHOICES: [string, string][] = Object.entries(EQUIPMENT_KIND_LABELS);
export const ENV_CHOICES: [string, string][] = [
  ["", "—"],
  ["prod", "Production"],
  ["preprod", "Préproduction"],
  ["dev", "Développement"],
  ["decommissioned", "Décommissionné"],
];
export const SEARCH_FIELDS = [
  "name",
  "os",
  "osVersion",
  "ipAddress",
  "hostServer",
  "hypervisor",
  "rolePrincipal",
  "serialNumber",
  "serviceTag",
  "location",
  "managementUrl",
  "manufacturerModel",
  "usage",
  "observations",
];

/** Équipements actifs, pour les selects « équipement lié » des autres modules. */
export async function activeEquipments() {
  return prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

function txt(f: FormData, key: string): string | null {
  const v = f.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** La famille à laquelle la fiche appartient : celle de l'équipement, ou celle d'où l'on vient. */
export function familleDemandee(
  item: { kind: string | null } | null,
  demandee?: string | null,
): string {
  if (item) return equipmentFamily(item.kind || "vm");
  const d = (demandee ?? "").trim();
  return d in EQUIPMENT_FAMILIES ? d : "serveurs";
}

/** `_apply_form` : les champs d'un équipement depuis le formulaire. */
export function depuisFormulaire(f: FormData): Prisma.EquipmentUncheckedCreateInput {
  const kindDemande = f.get("kind");
  const env = f.get("environment");
  return {
    kind:
      typeof kindDemande === "string" && kindDemande in EQUIPMENT_KIND_LABELS ? kindDemande : "vm",
    name: typeof f.get("name") === "string" ? (f.get("name") as string).trim() : "",
    environment: typeof env === "string" && env ? env : null,
    criticality: parseInt_(f.get("criticality"), null),
    os: txt(f, "os"),
    osVersion: txt(f, "os_version"),
    osLastUpdate: parseDate(f.get("os_last_update")),
    supervision: txt(f, "supervision"),
    supervised: Boolean(f.get("supervised")),
    cyberwatch: Boolean(f.get("cyberwatch")),
    ninjaOne: Boolean(f.get("ninja_one")),
    location: txt(f, "location"),
    managementUrl: txt(f, "management_url"),
    ports: parseInt_(f.get("ports"), null, 0),
    ipAddress: txt(f, "ip_address"),
    netmask: txt(f, "netmask"),
    vlan: txt(f, "vlan"),
    hostServer: txt(f, "host_server"),
    hypervisor: txt(f, "hypervisor"),
    vcpu: parseInt_(f.get("vcpu"), null),
    ramGo: parseFloat_(f.get("ram_go")),
    hdd1Go: parseFloat_(f.get("hdd1_go")),
    hdd2Go: parseFloat_(f.get("hdd2_go")),
    hdd3Go: parseFloat_(f.get("hdd3_go")),
    manufacturerModel: txt(f, "manufacturer_model"),
    serialNumber: txt(f, "serial_number"),
    serviceTag: txt(f, "service_tag"),
    purchaseDate: parseDate(f.get("purchase_date")),
    warrantyEnd: parseDate(f.get("warranty_end")),
    maintenanceContract: txt(f, "maintenance_contract"),
    supplierId: parseInt_(f.get("supplier_id"), null),
    protocols: txt(f, "protocols"),
    access: txt(f, "access"),
    capacityTo: parseFloat_(f.get("capacity_to")),
    usedTo: parseFloat_(f.get("used_to")),
    raid: txt(f, "raid"),
    rolePrincipal: txt(f, "role_principal"),
    userServices: txt(f, "user_services"),
    usage: txt(f, "usage"),
    praPca: txt(f, "pra_pca"),
    backup1: txt(f, "backup1"),
    backup1Freq: txt(f, "backup1_freq"),
    backup2: txt(f, "backup2"),
    backup2Freq: txt(f, "backup2_freq"),
    observations: txt(f, "observations"),
  };
}

export async function formContext(
  item: { kind: string | null } | null,
  familleUrl?: string | null,
) {
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return { famille: familleDemandee(item, familleUrl), suppliers, critLabels: CRITICALITY_LABELS };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

// ── Import Excel (inventory_import.py) ──

function norm(s: unknown): string {
  if (s === null || s === undefined) return "";
  let t = String(s).replace(/\n/g, " ").replace(/\r/g, " ");
  t = t.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return t.toLowerCase().split(/\s+/).filter(Boolean).join(" ");
}

type Typ = "text" | "date" | "float" | "int" | "bool" | "crit" | "env" | "superv";
type Champ = keyof Prisma.EquipmentUncheckedCreateInput;

// Règles ordonnées (les plus spécifiques d'abord) : (mot-clé, champ, type)
const RULES: [string, Champ, Typ][] = [
  ["frequence sauvegarde 1", "backup1Freq", "text"],
  ["frequence sauvegarde 2", "backup2Freq", "text"],
  ["sauvegarde 1", "backup1", "text"],
  ["sauvegarde 2", "backup2", "text"],
  ["sauvegarde", "backup1", "text"],
  ["derniere maj", "osLastUpdate", "date"],
  ["os / version", "os", "text"],
  ["os/version", "os", "text"],
  ["version", "osVersion", "text"],
  ["environnement", "environment", "env"],
  ["serveur hote", "hostServer", "text"],
  ["hyperviseur", "hypervisor", "text"],
  ["adresse ip", "ipAddress", "text"],
  ["masque", "netmask", "text"],
  ["maque", "netmask", "text"],
  ["vlan", "vlan", "text"],
  ["cyberwatch", "cyberwatch", "bool"],
  ["ninja", "ninjaOne", "bool"],
  ["supervision", "supervision", "superv"],
  ["vcpu", "vcpu", "int"],
  ["ram", "ramGo", "float"],
  ["stockage hdd 1", "hdd1Go", "float"],
  ["stockage hdd 2", "hdd2Go", "float"],
  ["stockage hdd 3", "hdd3Go", "float"],
  ["hdd 1", "hdd1Go", "float"],
  ["hdd 2", "hdd2Go", "float"],
  ["hdd 3", "hdd3Go", "float"],
  ["role principal", "rolePrincipal", "text"],
  ["logiciels", "businessSoftware", "text"],
  ["services utilisateurs", "userServices", "text"],
  ["criticite", "criticality", "crit"],
  ["constructeur", "manufacturerModel", "text"],
  ["modele", "manufacturerModel", "text"],
  ["numero de serie", "serialNumber", "text"],
  ["n de serie", "serialNumber", "text"],
  ["serie", "serialNumber", "text"],
  ["service tag", "serviceTag", "text"],
  ["servicetag", "serviceTag", "text"],
  ["date achat", "purchaseDate", "date"],
  ["mise en service", "purchaseDate", "date"],
  ["fin de garantie", "warrantyEnd", "date"],
  ["garantie", "warrantyEnd", "date"],
  ["pra", "praPca", "text"],
  ["pca", "praPca", "text"],
  ["protocoles", "protocols", "text"],
  ["acces", "access", "text"],
  ["capacite", "capacityTo", "float"],
  ["espace utilise", "usedTo", "float"],
  ["utilise", "usedTo", "float"],
  ["raid", "raid", "text"],
  ["contrat de maintenance", "maintenanceContract", "text"],
  ["usage principal", "usage", "text"],
  ["donnees stockees", "usage", "text"],
  ["usage", "usage", "text"],
  ["observations", "observations", "text"],
  ["os", "os", "text"],
  ["hostname", "name", "text"],
  ["nom d'hote", "name", "text"],
  ["nom", "name", "text"],
];

function matchField(h: string): [Champ, Typ] | null {
  for (const [kw, field, typ] of RULES) if (h.includes(kw)) return [field, typ];
  return null;
}

/** La nature, devinée du titre de l'onglet (les formes les plus précises d'abord). */
export function detectKind(title: string): string | null {
  const t = norm(title);
  if (t.includes("baie") || t.includes("san") || (t.includes("stockage") && !t.includes("nas")))
    return "storage";
  for (const mot of [
    "switch",
    "firewall",
    "pare-feu",
    "pare feu",
    "routeur",
    "router",
    "reseau",
    "wifi",
    "borne",
  ])
    if (t.includes(mot)) return "network";
  if (t.includes("nas")) return "nas";
  if (t.includes("vm")) return "vm";
  if (t.includes("phys")) return "physical";
  return null;
}

function findHeaderRow(rows: unknown[][]): number | null {
  let best: number | null = null;
  let bestScore = 0;
  rows.slice(0, 6).forEach((r, i) => {
    const score = r.filter((c) => matchField(norm(c))).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return bestScore >= 3 ? best : null;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date)
    return Number.isNaN(v.getTime())
      ? null
      : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (!v) return null;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(s);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    if (d.getUTCMonth() === +m[2] - 1) return d;
    const d2 = new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
    return Number.isNaN(d2.getTime()) ? null : d2;
  }
  return null;
}

function toFloat(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const first = String(v).replace(",", ".").trim().split(/\s+/)[0];
  const f = Number.parseFloat(first);
  return Number.isNaN(f) ? null : f;
}

function toInt(v: unknown): number | null {
  const f = toFloat(v);
  return f === null ? null : Math.trunc(f);
}

function toBool(v: unknown): boolean {
  const n = norm(v);
  if (!n) return false;
  return !["non", "no", "0", "false", "n"].includes(n);
}

function toCrit(v: unknown): number | null {
  for (const ch of norm(v)) if ("1234".includes(ch)) return Number.parseInt(ch, 10);
  return null;
}

function toEnv(v: unknown): string | null {
  const n = norm(v);
  if (n.includes("prepro") || n.includes("preprod")) return "preprod";
  if (n.includes("prod")) return "prod";
  if (n.includes("dev") || n.includes("recet")) return "dev";
  return null;
}

function assign(
  eq: Record<string, unknown>,
  value: unknown,
  field: Champ,
  typ: Typ,
  kind: string,
): void {
  const vide = value === null || value === undefined || value === "";
  if (typ === "text") {
    const v = vide ? null : String(value).trim();
    if (v) eq[field] = v;
  } else if (typ === "date") {
    const d = toDate(value);
    if (d) eq[field] = d;
  } else if (typ === "float") {
    const f = toFloat(value);
    if (f !== null) eq[field] = f;
  } else if (typ === "int") {
    const i = toInt(value);
    if (i !== null) eq[field] = i;
  } else if (typ === "bool") {
    eq[field] = toBool(value);
  } else if (typ === "crit") {
    const c = toCrit(value);
    if (c !== null) eq.criticality = c;
  } else if (typ === "env") {
    const e = toEnv(value);
    if (e) eq.environment = e;
  } else if (typ === "superv") {
    if (kind === "vm") eq.supervised = toBool(value);
    else {
      const v = vide ? null : String(value).trim();
      if (v) eq.supervision = v;
    }
  }
}

/** La valeur brute d'une cellule exceljs : formule → résultat, texte riche → texte, date → Date. */
function cellValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellValue(o.result);
    if (Array.isArray(o.richText))
      return (o.richText as { text: string }[]).map((r) => r.text).join("");
    if ("text" in o) return o.text;
    if ("error" in o) return null;
  }
  return v;
}

/** Lit le classeur et crée les équipements. Retourne (nb créés, rapport). */
export async function importWorkbook(buffer: Buffer): Promise<[number, string]> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  let created = 0;
  const notes: string[] = [];
  for (const ws of wb.worksheets) {
    const kind = detectKind(ws.name);
    if (!kind) {
      notes.push(`« ${ws.name} » ignoré (type inconnu)`);
      continue;
    }
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const valeurs = row.values as unknown[];
      rows.push(valeurs.slice(1).map(cellValue));
    });
    const hidx = findHeaderRow(rows);
    if (hidx === null) {
      notes.push(`« ${ws.name} » : en-tête introuvable`);
      continue;
    }
    const colmap = new Map<number, [Champ, Typ]>();
    rows[hidx].forEach((h, idx) => {
      const m = matchField(norm(h));
      if (m) colmap.set(idx, m);
    });
    let n = 0;
    for (const r of rows.slice(hidx + 1)) {
      if (!r.some((c) => c !== null && c !== undefined && c !== "")) continue;
      const eq: Record<string, unknown> = { kind };
      for (const [idx, [field, typ]] of colmap)
        if (idx < r.length) assign(eq, r[idx], field, typ, kind);
      if (!(typeof eq.name === "string" && eq.name.trim())) {
        const repli = String(
          eq.serialNumber || eq.ipAddress || eq.hostServer || eq.manufacturerModel || "",
        ).trim();
        eq.name = repli || null;
      }
      if (!eq.name) continue;
      await prisma.equipment.create({
        data: eq as unknown as Prisma.EquipmentUncheckedCreateInput,
      });
      created += 1;
      n += 1;
    }
    notes.push(`${ws.name} : ${n} ligne(s)`);
  }
  return [created, notes.join(" · ")];
}
