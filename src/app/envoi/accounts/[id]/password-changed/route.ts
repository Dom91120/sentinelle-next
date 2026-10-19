import { parseDate } from "@/lib/forms-util";
import { aujourdhui, dateCourte } from "@/lib/libelles";
import { ajouterJours } from "@/modules/accounts/server";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /accounts/<id>/password-changed */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("accounts");
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) return pasTrouve();
    const when = parseDate(form.get("changed_on")) ?? aujourdhui();
    await prisma.account.update({
      where: { id },
      data: { lastPasswordChange: when, nextPasswordChange: ajouterJours(when, account.rotationDays ?? 90) },
    });
    const comment = String(form.get("comment") ?? "").trim() || `Mot de passe changé le ${dateCourte(when)}`;
    await prisma.accountHistory.create({ data: { accountId: id, action: "password_changed", comment, performedBy: user.username } });
    invalidateNavCounts();
    return redirigerAvecMessage(`/accounts/${id}`, "Mot de passe marqué comme changé", "success");
  });
}
