import { fragmentContrat } from "@/app/fragment/contracts/route-commun";
import type { Prisma } from "@/generated/prisma/client";
import { depuisFormulaire, poserCouverts } from "@/modules/contracts/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /contracts/create */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const sid = url.searchParams.get("software_id");
  const fid = url.searchParams.get("supplier_id");
  const inline = url.searchParams.get("inline") === "1";
  const q = new URLSearchParams();
  if (sid) q.set("software_id", sid);
  if (fid) q.set("supplier_id", fid);
  const suffixe = q.toString() ? `?${q.toString()}` : "";
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("contracts");
    const { data, couverts } = await depuisFormulaire(form);
    // Formulaire chargé dans une liste (?inline=1) : l'erreur se rend sur place, dans le fragment.
    if (!data.name && inline)
      return fragmentContrat(req, null, {
        software_id: sid,
        supplier_id: fid,
        erreur: "Le nom du contrat est obligatoire.",
      });
    if (!data.name)
      return redirigerAvecMessage(
        `/contracts/create${suffixe}`,
        "Le nom du contrat est obligatoire.",
        "danger",
      );
    const c = await prisma.contract.create({ data: data as Prisma.ContractUncheckedCreateInput });
    await poserCouverts(c.id, couverts);
    await prisma.contractHistory.create({
      data: {
        contractId: c.id,
        action: "creation",
        comment: `Contrat cree : ${c.name}`,
        performedBy: user.username,
      },
    });
    invalidateNavCounts();
    // Créé depuis une fiche fournisseur : on y revient, sur son onglet Contrats.
    const retour = fid && c.supplierId ? `/suppliers/${c.supplierId}#contrats` : "/contracts";
    return redirigerAvecMessage(retour, "Contrat ajouté", "success");
  });
}
