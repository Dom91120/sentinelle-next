/** contracts/form.html : la grille, ou l'ancien formulaire (CONTRACT_FORM_LEGACY), et l'ajout rapide d'un fournisseur. */
import type { Contract } from "@/generated/prisma/client";
import { QaModalSupplier } from "@/components/quick-add";
import type { Couverts, FormContext } from "@/modules/contracts/server";
import { FormCorps, FormCorpsAncien } from "@/modules/contracts/vues";
import type { Page } from "@/server/page";

export function FormulaireContrat({ contract, ctx, couverts, page, retour, actionForm, dansFiche = false }: { contract: Contract | null; ctx: FormContext; couverts: Couverts; page: Page; retour: string; actionForm?: string; dansFiche?: boolean }) {
  const { user, csrf } = page;
  const legacy = user.settings.CONTRACT_FORM_LEGACY;
  const commun = { contract, ...ctx, couverts, user, csrf, retour, actionForm };
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
      {!dansFiche && user.canEdit("suppliers") ? <QaModalSupplier csrf={csrf} /> : null}
    </>
  );
}
