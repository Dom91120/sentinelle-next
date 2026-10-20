import { auditRecord } from "@/server/audit";
import { purgeAll } from "@/server/corbeille";
import { requireUser } from "@/server/guards";
import { redirigerAvecMessage, traiterFormulaire } from "@/server/http";

/** POST /trash/purge : droits vérifiés catégorie par catégorie dans purgeAll. */
export async function POST(req: Request) {
  return traiterFormulaire(req, async () => {
    const user = await requireUser();
    const n = await purgeAll(user);
    if (n)
      await auditRecord(
        "corbeille videe",
        `${n} element(s) supprime(s)`,
        "corbeille",
        user.username,
      );
    return redirigerAvecMessage(
      "/trash",
      n ? `Corbeille vidée (${n} élément(s) supprimé(s) définitivement).` : "Rien à supprimer.",
      n ? "success" : "info",
    );
  });
}
