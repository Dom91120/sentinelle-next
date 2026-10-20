/** Contrats, licences et abonnements (port de app/contracts.py). */
import type { Prisma } from "@/generated/prisma/client";
import { CONTRACT_NATURE_LABELS } from "@/lib/constantes";
import { champ, champOuNull, parseDate, parseFloat_, parseInt_ } from "@/lib/forms-util";
import { prisma } from "@/server/db";

export function natureLabel(c: { nature: string | null }): string {
  return CONTRACT_NATURE_LABELS[c.nature ?? ""] ?? "";
}

export async function formContext(logicielsChoisis: number[] = []) {
  const [kindOptions, suppliers, equipments, softwareList] = await Promise.all([
    prisma.referential.findMany({
      where: { kind: "contract_kind", isActive: true },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.software.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { supplier: true },
    }),
  ]);
  return {
    logicielsChoisis,
    kindOptions,
    natureLabels: CONTRACT_NATURE_LABELS,
    suppliers,
    equipments,
    softwareList,
  };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

function ids(f: FormData, cle: string): number[] {
  return f
    .getAll(cle)
    .map((v) => parseInt_(v, null))
    .filter((v): v is number => Boolean(v));
}

export type Couverts = { software: number[]; equipment: number[] };

/** `_fill` : les champs d'un contrat depuis le formulaire, et les éléments couverts à poser. */
export async function depuisFormulaire(
  f: FormData,
): Promise<{ data: Prisma.ContractUncheckedUpdateInput; couverts: Couverts }> {
  const typeId = parseInt_(f.get("kind_id"), null);
  const kindId =
    typeId &&
    (await prisma.referential.findFirst({
      where: { id: typeId, kind: "contract_kind" },
      select: { id: true },
    }))
      ? typeId
      : null;
  const natureDemande = f.get("nature");
  const duree = parseInt_(f.get("firm_years"), null, 0);
  const renouv = parseInt_(f.get("renewals"), null, 0);
  const periode = parseInt_(f.get("renewal_years"), null, 0);
  const data: Prisma.ContractUncheckedUpdateInput = {
    name: champ(f, "name"),
    kindId,
    nature:
      typeof natureDemande === "string" && natureDemande in CONTRACT_NATURE_LABELS
        ? natureDemande
        : null,
    supplierId: parseInt_(f.get("supplier_id"), null),
    reference: champOuNull(f, "reference"),
    supplierReference: champOuNull(f, "supplier_reference"),
    costYearly: parseFloat_(f.get("cost_yearly")),
    costMaxYearly: parseFloat_(f.get("cost_max_yearly")),
    costTotal: parseFloat_(f.get("cost_total")),
    startDate: parseDate(f.get("start_date")),
    endDate: parseDate(f.get("end_date")),
    firmYears: duree && duree <= 4 ? duree : null,
    renewals: renouv !== null && renouv <= 3 ? renouv : null,
    renewalYears: periode && periode <= 4 ? periode : null,
    noticeDays: Math.min(parseInt_(f.get("notice_days"), 0, 0) ?? 0, 365),
    autoRenew: f.get("auto_renew") === "on",
    budgetCode: champOuNull(f, "budget_code"),
    orderSignedOn: parseDate(f.get("order_signed_on")),
    description:
      typeof f.get("description") === "string" && f.get("description")
        ? (f.get("description") as string)
        : null,
  };
  // Éléments couverts : une seule liste « famille:id » (covered_ids), et les deux listes historiques.
  const couverts: Couverts = { software: [], equipment: [] };
  for (const v of f.getAll("covered_ids")) {
    if (typeof v !== "string") continue;
    const [famille, num] = v.split(":", 2);
    const n = parseInt_(num, null);
    if ((famille === "software" || famille === "equipment") && n) couverts[famille].push(n);
  }
  couverts.equipment.push(...ids(f, "equipment_ids"));
  couverts.software.push(...ids(f, "software_ids"));
  return { data, couverts };
}

/** Pose les éléments couverts (équipements et logiciels actifs seulement). */
export async function poserCouverts(contractId: number, couverts: Couverts): Promise<void> {
  const eids = [...new Set(couverts.equipment)];
  const sids = [...new Set(couverts.software)];
  const [equipements, logiciels] = await Promise.all([
    eids.length
      ? prisma.equipment.findMany({
          where: { id: { in: eids }, isActive: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    sids.length
      ? prisma.software.findMany({
          where: { id: { in: sids }, isActive: true },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);
  await prisma.contractEquipment.deleteMany({ where: { contractId } });
  if (equipements.length)
    await prisma.contractEquipment.createMany({
      data: equipements.map((e) => ({ contractId, equipmentId: e.id })),
    });
  await prisma.contractSoftware.deleteMany({ where: { contractId } });
  if (logiciels.length)
    await prisma.contractSoftware.createMany({
      data: logiciels.map((s) => ({ contractId, softwareId: s.id })),
    });
}

/** Les éléments couverts d'un contrat (ids). */
export async function couvertsDe(contractId: number): Promise<Couverts> {
  const [e, s] = await Promise.all([
    prisma.contractEquipment.findMany({ where: { contractId }, select: { equipmentId: true } }),
    prisma.contractSoftware.findMany({ where: { contractId }, select: { softwareId: true } }),
  ]);
  return { software: s.map((x) => x.softwareId), equipment: e.map((x) => x.equipmentId) };
}
