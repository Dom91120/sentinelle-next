import { aujourdhui } from "@/lib/libelles";
import { prisma } from "@/server/db";
import { requireEdit } from "@/server/guards";
import { idDe, pasTrouve, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { invalidateNavCounts } from "@/server/nav";

/** POST /updates/<id>/mark-updated */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = idDe((await params).id);
  if (!id) return pasTrouve();
  return traiterFormulaire(req, async (form) => {
    const user = await requireEdit("updates");
    const update = await prisma.systemUpdate.findUnique({ where: { id } });
    if (!update) return pasTrouve();
    const currentVersion = update.latestVersion ? update.latestVersion : update.currentVersion;
    await prisma.systemUpdate.update({ where: { id }, data: { currentVersion, status: "up_to_date", lastUpdate: aujourdhui() } });
    const note = typeof form.get("comment") === "string" ? (form.get("comment") as string).trim() : "";
    let comment = `Mis a jour en version ${currentVersion || "?"}`;
    if (note) comment += ` — ${note}`;
    await prisma.updateHistory.create({ data: { updateId: id, action: "updated", comment, performedBy: user.username } });
    invalidateNavCounts();
    return redirigerAvecMessage(`/updates/${id}`, "Marque comme a jour", "success");
  });
}
