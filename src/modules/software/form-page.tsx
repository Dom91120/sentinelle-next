/** software/form.html : la grille de SoftInventory et sa modale d'ajout rapide d'un éditeur. */

import type { Software } from "@/generated/prisma/client";
import type { FormContext } from "@/modules/software/server";
import { FormCorps } from "@/modules/software/vues";
import { QaModalSupplier } from "@/modules/suppliers/vues";
import type { Page } from "@/server/page";

export type Rattachements = { contractIds: number[]; equipmentIds: number[]; serviceIds: number[] };

export function FormulaireLogiciel({
  item,
  ctx,
  page,
  retour,
  rattachements,
  dansFiche = false,
}: {
  item: Software | null;
  ctx: FormContext;
  page: Page;
  retour: string;
  rattachements: Rattachements;
  dansFiche?: boolean;
}) {
  const { user, csrf, nonce } = page;
  const gdpr = page.features.gdpr;
  const commun = {
    item,
    ...ctx,
    user,
    csrf,
    nonce,
    retour,
    gdpr,
    itemContractIds: rattachements.contractIds,
    itemEquipmentIds: rattachements.equipmentIds,
    itemServiceIds: rattachements.serviceIds,
  };
  return (
    <>
      <FormCorps {...commun} />
      {!dansFiche && user.canEdit("suppliers") ? <QaModalSupplier csrf={csrf} /> : null}
    </>
  );
}

export async function rattachementsDe(
  prisma: typeof import("@/server/db").prisma,
  id: number | null,
): Promise<Rattachements> {
  if (!id) return { contractIds: [], equipmentIds: [], serviceIds: [] };
  const [c, e, s] = await Promise.all([
    prisma.contractSoftware.findMany({ where: { softwareId: id }, select: { contractId: true } }),
    prisma.softwareEquipment.findMany({ where: { softwareId: id }, select: { equipmentId: true } }),
    prisma.softwareService.findMany({ where: { softwareId: id }, select: { userServiceId: true } }),
  ]);
  return {
    contractIds: c.map((x) => x.contractId),
    equipmentIds: e.map((x) => x.equipmentId),
    serviceIds: s.map((x) => x.userServiceId),
  };
}
