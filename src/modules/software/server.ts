/** Logiciels métiers (port de app/software.py). */
import type { Prisma } from "@/generated/prisma/client";
import { AUTH_MODE_LABELS, CRITICALITY_COLORS, CRITICALITY_LABELS, DATA_LOCATION_LABELS, HOSTING_LABELS, LIFECYCLE_COLORS, LIFECYCLE_LABELS, SOURCE_TYPE_LABELS } from "@/lib/constantes";
import { champ, champOuNull, parseDate, parseInt_ } from "@/lib/forms-util";
import { prisma } from "@/server/db";

export const SEARCH_FIELDS = ["name", "version", "responsible", "responsibleEmail", "techResponsible", "techResponsibleEmail", "description"];

type SoftwareLabels = { hosting: string; lifecycle: string; sourceType: string | null; authMode: string | null; gdprLocation: string | null; criticality: number | null };

export function hostingLabel(s: SoftwareLabels): string {
  return HOSTING_LABELS[s.hosting] ?? s.hosting ?? "";
}
export function lifecycleLabel(s: SoftwareLabels): string {
  return LIFECYCLE_LABELS[s.lifecycle] ?? s.lifecycle ?? "";
}
export function lifecycleColor(s: SoftwareLabels): string {
  return LIFECYCLE_COLORS[s.lifecycle] ?? "secondary";
}
export function sourceTypeLabel(s: SoftwareLabels): string {
  return SOURCE_TYPE_LABELS[s.sourceType ?? ""] ?? s.sourceType ?? "";
}
export function authModeLabel(s: SoftwareLabels): string {
  return AUTH_MODE_LABELS[s.authMode ?? ""] ?? s.authMode ?? "";
}
export function gdprLocationLabel(s: SoftwareLabels): string {
  return DATA_LOCATION_LABELS[s.gdprLocation ?? ""] ?? s.gdprLocation ?? "";
}
export function criticalityLabel(s: SoftwareLabels): string {
  if (!s.criticality) return "";
  return CRITICALITY_LABELS[s.criticality] ?? "";
}
export function criticalityColor(s: SoftwareLabels): string {
  return CRITICALITY_COLORS[s.criticality ?? 0] ?? "secondary";
}

/** Les listes du formulaire (_form_context). */
export async function formContext() {
  const [suppliers, contracts, equipments, technologies, userServices] = await Promise.all([
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.contract.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.referential.findMany({ where: { kind: "technology", isActive: true }, orderBy: [{ position: "asc" }, { label: "asc" }] }),
    prisma.userService.findMany({ where: { isActive: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
  ]);
  return { suppliers, contracts, equipments, technologies, userServices };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

function ids(f: FormData, cle: string): number[] {
  return f
    .getAll(cle)
    .map((v) => parseInt_(v, null))
    .filter((v): v is number => Boolean(v));
}

/** `_fill` : les champs scalaires d'un logiciel depuis le formulaire. */
export function depuisFormulaire(f: FormData, gdpr: boolean): Prisma.SoftwareUncheckedUpdateInput {
  const choix = (cle: string, labels: Record<string, string>, defaut: string | null) => {
    const v = f.get(cle);
    return typeof v === "string" && v in labels ? v : defaut;
  };
  const data: Prisma.SoftwareUncheckedUpdateInput = {
    supplierId: parseInt_(f.get("supplier_id"), null),
    version: champOuNull(f, "version"),
    criticality: parseInt_(f.get("criticality"), null),
    name: champ(f, "name"),
    hosting: choix("hosting", HOSTING_LABELS, "on_premise") as string,
    isDocker: f.get("is_docker") === "on",
    internalDev: f.get("internal_dev") === "on",
    noServer: f.get("no_server") === "on",
    lifecycle: choix("lifecycle", LIFECYCLE_LABELS, "production") as string,
    sourceType: choix("source_type", SOURCE_TYPE_LABELS, "proprietaire"),
    technologyId: parseInt_(f.get("technology_id"), null),
    authMode: choix("auth_mode", AUTH_MODE_LABELS, null),
    authStrong: f.get("auth_strong") === "on",
    usersCount: parseInt_(f.get("users_count"), null, 0),
    usersMax: parseInt_(f.get("users_max"), null, 0),
    serviceDate: parseDate(f.get("service_date")),
    url: champOuNull(f, "url"),
    responsible: champOuNull(f, "responsible"),
    responsibleEmail: champOuNull(f, "responsible_email"),
    techResponsible: champOuNull(f, "tech_responsible"),
    techResponsibleEmail: champOuNull(f, "tech_responsible_email"),
    description: typeof f.get("description") === "string" && f.get("description") ? (f.get("description") as string) : null,
  };
  if (f.has("no_contract_note")) data.noContractNote = champOuNull(f, "no_contract_note");
  // Volet RGPD : module coupé, le formulaire ne porte pas ces champs.
  if (gdpr) {
    data.gdprPersonalData = f.get("gdpr_personal_data") === "on";
    data.gdprCategories = champOuNull(f, "gdpr_categories");
    data.gdprRegistryRef = champOuNull(f, "gdpr_registry_ref");
    data.gdprLocation = choix("gdpr_location", DATA_LOCATION_LABELS, "inconnue");
  }
  return data;
}

/** Les rattachements (marchés, serveurs, services) : lus seulement s'ils sont ENVOYÉS. */
export async function poserRattachements(softwareId: number, f: FormData): Promise<void> {
  if (f.has("contract_ids")) {
    const cids = ids(f, "contract_ids");
    const actifs = cids.length ? await prisma.contract.findMany({ where: { id: { in: cids }, isActive: true }, select: { id: true } }) : [];
    await prisma.contractSoftware.deleteMany({ where: { softwareId } });
    if (actifs.length) await prisma.contractSoftware.createMany({ data: actifs.map((c) => ({ contractId: c.id, softwareId })) });
  }
  if (f.has("equipment_ids")) {
    const eids = ids(f, "equipment_ids");
    const actifs = eids.length ? await prisma.equipment.findMany({ where: { id: { in: eids }, isActive: true }, select: { id: true } }) : [];
    await prisma.softwareEquipment.deleteMany({ where: { softwareId } });
    if (actifs.length) await prisma.softwareEquipment.createMany({ data: actifs.map((e) => ({ equipmentId: e.id, softwareId })) });
  }
  if (f.has("user_service_ids")) await poserServices(softwareId, ids(f, "user_service_ids"));
}

/** Les services utilisateurs du logiciel : ce qui est coché est la liste, ni plus ni moins. */
export async function poserServices(softwareId: number, svids: number[]): Promise<number> {
  const actifs = svids.length ? await prisma.userService.findMany({ where: { id: { in: svids }, isActive: true }, select: { id: true } }) : [];
  await prisma.softwareService.deleteMany({ where: { softwareId } });
  if (actifs.length) await prisma.softwareService.createMany({ data: actifs.map((s) => ({ userServiceId: s.id, softwareId })) });
  return actifs.length;
}

/** Les marchés qu'on peut rattacher à cette fiche : ceux de son éditeur et ceux que personne ne couvre encore. */
export async function marchesRattachables(item: { id: number; supplierId: number | null }) {
  const deja = new Set((await prisma.contractSoftware.findMany({ where: { softwareId: item.id }, select: { contractId: true } })).map((r) => r.contractId));
  const tous = await prisma.contract.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { kindRef: true, supplier: true, software: { select: { softwareId: true } } } });
  return tous.filter((c) => !deja.has(c.id) && ((item.supplierId && c.supplierId === item.supplierId) || c.software.length === 0));
}
