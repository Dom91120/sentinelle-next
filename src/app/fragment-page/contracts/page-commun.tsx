/**
 * Le formulaire d'un marché rendu seul, dans une page que `server/fragment.ts`
 * découpe : tout ce qui est entre `<div id="fragment">` et `<!--/fragment-->` part
 * dans la liste du logiciel (formulaire-inline.js).
 */
import { notFound, redirect } from "next/navigation";
import type { Contract } from "@/generated/prisma/client";
import {
  type Couverts,
  couvertsDe,
  type FormContext,
  formContext,
} from "@/modules/contracts/server";
import { FormCorps } from "@/modules/contracts/vues";
import { categoryEnabledIn } from "@/server/features";
import { readFlashes } from "@/server/flash";
import { getCurrentUser } from "@/server/guards";
import { csrfToken } from "@/server/http";

export async function FragmentContrat({
  contract,
  logicielsChoisis = [],
  fournisseurChoisi = null,
  erreur,
}: {
  contract: Contract | null;
  logicielsChoisis?: number[];
  fournisseurChoisi?: number | null;
  erreur?: string | null;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.canEdit("contracts") || !categoryEnabledIn(user.settings, "contracts")) notFound();
  const [ctx, couverts]: [FormContext, Couverts] = await Promise.all([
    formContext(logicielsChoisis),
    contract ? couvertsDe(contract.id) : Promise.resolve({ software: [], equipment: [] }),
  ]);
  const csrf = await csrfToken();
  const retour = contract
    ? `/contracts/${contract.id}`
    : fournisseurChoisi
      ? `/suppliers/${fournisseurChoisi}#contrats`
      : "/contracts";
  const messages = await readFlashes();
  if (erreur) messages.push(["danger", erreur]);
  return (
    <div id="fragment">
      {messages.map(([categorie, message], i) => (
        <div
          key={`${i}-${message}`}
          className={`alert alert-${categorie === "danger" ? "danger" : "info"} py-2 small`}
        >
          {message}
        </div>
      ))}
      <FormCorps
        contract={contract}
        {...ctx}
        couverts={couverts}
        user={user}
        csrf={csrf}
        retour={retour}
        inline
        fournisseurChoisi={fournisseurChoisi}
      />
      {/* fin du fragment : voir server/fragment.ts */}
      <FinFragment />
    </div>
  );
}

function FinFragment() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: repère statique, sans donnée.
  return <span hidden dangerouslySetInnerHTML={{ __html: "<!--/fragment-->" }} />;
}
