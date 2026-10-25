/** contracts/form.html : la grille et l'ajout rapide d'un fournisseur. */

import { QaModalSupplier } from "@/components/quick-add";
import type { Contract } from "@/generated/prisma/client";
import type { Couverts, FormContext } from "@/modules/contracts/server";
import { FormCorps } from "@/modules/contracts/vues";
import type { Page } from "@/server/page";

export function FormulaireContrat({
  contract,
  ctx,
  couverts,
  page,
  retour,
  actionForm,
  dansFiche = false,
}: {
  contract: Contract | null;
  ctx: FormContext;
  couverts: Couverts;
  page: Page;
  retour: string;
  actionForm?: string;
  dansFiche?: boolean;
}) {
  const { user, csrf } = page;
  const commun = { contract, ...ctx, couverts, user, csrf, retour, actionForm };
  return (
    <>
      <FormCorps {...commun} />
      {!dansFiche && user.canEdit("suppliers") ? <QaModalSupplier csrf={csrf} /> : null}
    </>
  );
}
