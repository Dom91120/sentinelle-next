import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { champ, coche } from "@/lib/forms-util";
import { CARTES_API, cookieNouvelleCle } from "@/modules/connecteurs/server";
import { auditRecord } from "@/server/audit";
import { saveSettings } from "@/server/config-store";
import { requireAdmin } from "@/server/guards";
import { redirection, redirigerAvecMessage, traiterFormulaire } from "@/server/http";

const RETOUR = "/connecteurs";

/** Active/désactive un connecteur machine-à-machine ou (re)génère sa clé d'API (`_regler_carte`). */
export function reglerCarte(prefixe: string) {
  return async (req: Request): Promise<Response> =>
    traiterFormulaire(
      req,
      async (form) => {
        const admin = await requireAdmin();
        const [nom, cleActive, cleToken] = CARTES_API[prefixe];
        const action = champ(form, "action");
        if (action === "save") {
          const enabled = coche(form, `${prefixe}_enabled`);
          await saveSettings({ [cleActive]: enabled ? "true" : "false" });
          await auditRecord(
            `config connecteur ${nom}`,
            `actif=${enabled ? "True" : "False"}`,
            "preferences",
            admin.username,
          );
          return redirigerAvecMessage(
            RETOUR,
            `Connecteur ${nom} ${enabled ? "activé" : "désactivé"}.`,
            "success",
          );
        }
        if (action === "generate_key") {
          const key = randomBytes(32).toString("base64url");
          await saveSettings({ [cleToken]: key });
          // Affichée UNE fois via un cookie à usage unique (champ copiable) : un flash serait
          // rendu en toast auto-disparaissant, donc non copiable.
          (await cookies()).set(cookieNouvelleCle(prefixe), key, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 300,
            secure: process.env.NODE_ENV === "production",
          });
          await auditRecord(`rotation clé API ${nom}`, "", "preferences", admin.username);
          return redirigerAvecMessage(
            RETOUR,
            `Nouvelle clé API ${nom} générée — copiez-la ci-dessous, elle ne sera plus affichée.`,
            "success",
          );
        }
        return redirection(RETOUR);
      },
      RETOUR,
    );
}
