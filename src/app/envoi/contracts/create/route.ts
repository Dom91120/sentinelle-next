import type { Prisma } from "@/generated/prisma/client";
import { depuisFormulaire, poserCouverts } from "@/modules/contracts/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /contracts/create */
export async function POST(req: Request) {
  const sid = new URL(req.url).searchParams.get("software_id");
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("contracts");
    const { data, couverts } = await depuisFormulaire(form);
    if (!data.name)
      return redirigerAvecMessage(
        `/contracts/create${sid ? `?software_id=${encodeURIComponent(sid)}` : ""}`,
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
    return redirigerAvecMessage("/contracts", "Contrat ajouté", "success");
  });
}
