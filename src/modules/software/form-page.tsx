/** software/form.html : le formulaire, grille de SoftInventory ou ancien (SOFTWARE_FORM_LEGACY), et ses modales d'ajout rapide. */
import { QaModalContract, QaModalEquipment, QaModalSupplier } from "@/components/quick-add";
import type { FormContext } from "@/modules/software/server";
import { FormCorps, FormCorpsAncien } from "@/modules/software/vues";
import type { Software } from "@/generated/prisma/client";
import type { Page } from "@/server/page";

export type Rattachements = { contractIds: number[]; equipmentIds: number[]; serviceIds: number[] };

export function FormulaireLogiciel({ item, ctx, page, retour, rattachements, dansFiche = false }: { item: Software | null; ctx: FormContext; page: Page; retour: string; rattachements: Rattachements; dansFiche?: boolean }) {
  const { user, csrf, nonce } = page;
  const legacy = user.settings.SOFTWARE_FORM_LEGACY;
  const gdpr = page.features.gdpr;
  const commun = { item, ...ctx, user, csrf, nonce, retour, gdpr, itemContractIds: rattachements.contractIds, itemEquipmentIds: rattachements.equipmentIds, itemServiceIds: rattachements.serviceIds };
  return (
    <>
      {legacy ? (
        dansFiche ? (
          <div className="data-card p-4">
            <FormCorpsAncien {...commun} />
          </div>
        ) : (
          <div className="form-page">
            <nav className="form-sommaire" aria-label="Rubriques du formulaire" />
            <div className="form-corps">
              <div className="data-card p-4">
                <FormCorpsAncien {...commun} />
              </div>
            </div>
          </div>
        )
      ) : (
        <FormCorps {...commun} />
      )}
      {!dansFiche ? (
        <>
          {user.canEdit("suppliers") ? <QaModalSupplier csrf={csrf} /> : null}
          {legacy && user.canEdit("contracts") ? <QaModalContract csrf={csrf} /> : null}
          {legacy && user.canEdit("inventory") ? <QaModalEquipment csrf={csrf} /> : null}
        </>
      ) : null}
    </>
  );
}

export async function rattachementsDe(prisma: typeof import("@/server/db").prisma, id: number | null): Promise<Rattachements> {
  if (!id) return { contractIds: [], equipmentIds: [], serviceIds: [] };
  const [c, e, s] = await Promise.all([
    prisma.contractSoftware.findMany({ where: { softwareId: id }, select: { contractId: true } }),
    prisma.softwareEquipment.findMany({ where: { softwareId: id }, select: { equipmentId: true } }),
    prisma.softwareService.findMany({ where: { softwareId: id }, select: { userServiceId: true } }),
  ]);
  return { contractIds: c.map((x) => x.contractId), equipmentIds: e.map((x) => x.equipmentId), serviceIds: s.map((x) => x.userServiceId) };
}
