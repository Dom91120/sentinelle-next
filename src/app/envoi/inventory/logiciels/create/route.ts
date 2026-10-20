import { champ } from "@/lib/forms-util";
import { depuisFormulaire, poserRattachements } from "@/modules/software/server";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import { enabledIn } from "@/server/features";
import { requireEdit } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";
import type { Prisma } from "@/generated/prisma/client";

/** POST /software/create */
export async function POST(req: Request) {
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("software");
    if (!champ(form, "name")) return redirigerAvecMessage("/inventory/logiciels/create", "Le nom du logiciel est obligatoire.", "danger");
    const data = depuisFormulaire(form, enabledIn(user.settings, "gdpr")) as Prisma.SoftwareUncheckedCreateInput;
    const sw = await prisma.software.create({ data });
    await poserRattachements(sw.id, form);
    await auditRecord("creation logiciel", sw.name, "inventory", user.username);
    invalidateNavCounts();
    return redirigerAvecMessage(`/inventory/logiciels/${sw.id}`, "Logiciel ajouté", "success");
  });
}
