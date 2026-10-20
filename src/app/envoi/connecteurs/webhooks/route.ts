import { CATEGORY_LABELS, WEBHOOK_CHANNELS } from "@/lib/constantes";
import { champ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { getSettings, saveSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/guards";
import { redirection, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { sendTo } from "@/server/notify";

const RETOUR = "/connecteurs";

/** POST /connecteurs/webhooks : URLs globales, tests, et webhooks par catégorie (ajout/suppression/test). */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const admin = await requireAdmin();
      const action = champ(form, "action");
      const cfg = await getSettings();
      const audit = (a: string, detail = "") =>
        auditRecord(a, detail, "preferences", admin.username);

      if (action === "save_webhooks") {
        await saveSettings({
          TEAMS_WEBHOOK_URL: champ(form, "teams_webhook"),
          SLACK_WEBHOOK_URL: champ(form, "slack_webhook"),
          DISCORD_WEBHOOK_URL: champ(form, "discord_webhook"),
        });
        await audit("config notifications");
        return redirigerAvecMessage(RETOUR, "Notifications enregistrées", "success");
      }

      if (action === "test_teams" || action === "test_slack" || action === "test_discord") {
        const canal = action.slice(5);
        const url = cfg[`${canal.toUpperCase()}_WEBHOOK_URL`] as string | undefined;
        const ok = await sendTo(
          canal,
          url,
          "Test de notification",
          "Notification de test depuis Sentinelle.",
          "info",
          cfg.APP_BASE_URL,
        );
        const nom = canal.charAt(0).toUpperCase() + canal.slice(1);
        return redirigerAvecMessage(
          RETOUR,
          ok ? `Notification ${nom} envoyée.` : `Échec de l'envoi ${nom} (URL invalide ?).`,
          ok ? "success" : "danger",
        );
      }

      if (action === "add_webhook") {
        const channel = champ(form, "wh_channel");
        const url = champ(form, "wh_url");
        let category = champ(form, "wh_category") || "all";
        if (!(channel in WEBHOOK_CHANNELS))
          return redirigerAvecMessage(RETOUR, "Canal invalide.", "danger");
        if (!url)
          return redirigerAvecMessage(RETOUR, "L'URL du webhook est obligatoire.", "danger");
        // Limite le risque de SSRF / d'exfiltration vers un hôte interne : les webhooks Teams/Slack/Discord sont tous en HTTPS.
        if (!url.toLowerCase().startsWith("https://"))
          return redirigerAvecMessage(
            RETOUR,
            "L'URL du webhook doit commencer par https://",
            "danger",
          );
        if (category !== "all" && !(category in CATEGORY_LABELS)) category = "all";
        await prisma.webhook.create({
          data: { category, channel, url, label: champ(form, "wh_label") || null },
        });
        await audit("ajout webhook", `${channel} / ${category}`);
        return redirigerAvecMessage(RETOUR, "Webhook ajouté", "success");
      }

      if (action === "delete_webhook") {
        const id = Number.parseInt(champ(form, "wh_id"), 10);
        const w = Number.isInteger(id) ? await prisma.webhook.findUnique({ where: { id } }) : null;
        if (w) {
          await prisma.webhook.delete({ where: { id: w.id } });
          await audit("suppression webhook", `${w.channel} / ${w.category}`);
          return redirigerAvecMessage(RETOUR, "Webhook supprimé", "success");
        }
        return redirection(RETOUR);
      }

      if (action === "test_webhook") {
        const id = Number.parseInt(champ(form, "wh_id"), 10);
        const w = Number.isInteger(id) ? await prisma.webhook.findUnique({ where: { id } }) : null;
        if (w) {
          const ok = await sendTo(
            w.channel,
            w.url,
            "Test de notification",
            "Ceci est un message de test depuis Sentinelle.",
            "info",
            cfg.APP_BASE_URL,
          );
          return redirigerAvecMessage(
            RETOUR,
            ok ? "Test envoyé." : "Échec de l'envoi du test.",
            ok ? "success" : "danger",
          );
        }
      }
      return redirection(RETOUR);
    },
    RETOUR,
  );
}
