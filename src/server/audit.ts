/**
 * Journal d'actions central (port de app/audit.py) : qui fait quoi, et quand.
 * Persiste même après suppression définitive de l'élément concerné.
 */
import { prisma } from "@/server/db";
import { getSession } from "@/server/guards";

/** Enregistre une action au nom de l'utilisateur connecté. Best-effort. */
export async function auditRecord(
  action: string,
  detail = "",
  category: string | null = null,
  username?: string | null,
): Promise<void> {
  try {
    let qui = username;
    if (qui === undefined) {
      try {
        const session = await getSession();
        qui = session?.user.username ?? "anonyme";
      } catch {
        qui = "system";
      }
    }
    await prisma.actionLog.create({
      data: { username: qui ?? "system", action, category, detail: detail || null },
    });
  } catch (e) {
    console.error("[audit] écriture impossible :", action, e);
  }
}
