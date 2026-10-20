import type { Prisma } from "@/generated/prisma/client";
import { depuisFormulaire } from "@/modules/suppliers/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /suppliers/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("suppliers");
    const data = depuisFormulaire(form);
    if (!data.name) return redirigerAvecMessage("/suppliers/create", "Le nom du fournisseur est obligatoire.", "danger");
    const s = await prisma.supplier.create({ data: data as Prisma.SupplierUncheckedCreateInput });
    await auditRecord("creation fournisseur", s.name, "contrats", user.username);
    return redirigerAvecMessage("/suppliers", "Fournisseur ajouté", "success");
  });
}
