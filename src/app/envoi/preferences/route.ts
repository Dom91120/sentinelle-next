import fs from "node:fs/promises";
import path from "node:path";
import { champ, coche } from "@/lib/forms-util";
import { normalizeColor } from "@/lib/theming";
import { parseEmails } from "@/modules/preferences/server";
import { setConformityCategories } from "@/server/app-settings";
import { auditRecord } from "@/server/audit";
import { getSettings, saveSettings } from "@/server/config-store";
import { backupDatabase, deleteBackup } from "@/server/db-backup";
import { buildDailyDigest } from "@/server/digest";
import { FEATURES, type FeatureName } from "@/server/features";
import { flash } from "@/server/flash";
import { requireAdmin } from "@/server/guards";
import { redirection, redirigerAvecMessage, traiterFormulaire } from "@/server/http";
import { testLdapConnection } from "@/server/ldap";
import { clearO365Token, sendEmail } from "@/server/mailer";
import { sendReport } from "@/server/pdf-report";

const PREFS = "/preferences";
const b = (v: boolean) => (v ? "true" : "false");
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** POST /preferences (auth.preferences) : toutes les actions de la page, admin seulement. */
export async function POST(req: Request) {
  return traiterFormulaire(
    req,
    async (form) => {
      const user = await requireAdmin();
      const action = champ(form, "action");
      const audit = (a: string, detail = "", category = "preferences") =>
        auditRecord(a, detail, category, user.username);
      const ok = (m: string) => redirigerAvecMessage(PREFS, m, "success");
      const ko = (m: string) => redirigerAvecMessage(PREFS, m, "danger");

      switch (action) {
        case "save_mail_enabled": {
          const enabled = coche(form, "mail_enabled");
          await saveSettings({ MAIL_ENABLED: b(enabled) });
          await audit("config messagerie", `envoi actif=${enabled ? "True" : "False"}`);
          return ok(`Envoi des mails ${enabled ? "activé" : "désactivé"}.`);
        }
        case "set_mail_method": {
          const method = champ(form, "mail_method") || "smtp";
          await saveSettings({ MAIL_METHOD: method });
          await audit("config messagerie", `methode=${method}`);
          return ok(`Methode de messagerie changee en ${method.toUpperCase()}`);
        }
        case "save_o365": {
          await saveSettings({
            MAIL_METHOD: "o365",
            O365_CLIENT_ID: champ(form, "o365_client_id"),
            O365_CLIENT_SECRET: champ(form, "o365_client_secret"),
            O365_TENANT_ID: champ(form, "o365_tenant_id"),
            O365_SENDER_EMAIL: champ(form, "o365_sender_email"),
            O365_REDIRECT_URI: champ(form, "o365_redirect_uri"),
          });
          await audit("config messagerie", "Office 365");
          return ok("Configuration Office 365 enregistree");
        }
        case "disconnect_o365": {
          await clearO365Token();
          return ok("Compte Office 365 deconnecte");
        }
        case "save_smtp": {
          const server = champ(form, "smtp_server");
          const port = champ(form, "smtp_port") || "587";
          const username = champ(form, "smtp_username");
          const password = champ(form, "smtp_password");
          // Adresse expéditrice, découplée de l'identifiant : indispensable pour le Direct Send.
          const sender = champ(form, "smtp_sender") || username;
          const updates: Record<string, string> = {
            MAIL_METHOD: "smtp",
            MAIL_SERVER: server,
            MAIL_PORT: port,
            MAIL_USERNAME: username,
            MAIL_DEFAULT_SENDER: sender,
          };
          if (password) updates.MAIL_PASSWORD = password;
          await saveSettings(updates);
          await audit("config messagerie", `SMTP ${server}`);
          return ok("Configuration SMTP enregistree");
        }
        case "save_recipients": {
          const { ALERT_CATEGORIES } = await import("@/lib/constantes");
          const recipients = parseEmails(champ(form, "alert_recipients"));
          const updates: Record<string, string> = { ALERT_RECIPIENTS: recipients.join(",") };
          for (const cat of ALERT_CATEGORIES) {
            updates[`ALERT_RECIPIENTS_${cat.toUpperCase()}`] = parseEmails(
              champ(form, `alert_recipients_${cat}`),
            ).join(",");
          }
          await saveSettings(updates);
          await audit("destinataires alertes", `${recipients.length} adresse(s) globales`);
          return ok("Destinataires enregistrés");
        }
        case "save_report": {
          let schedule = champ(form, "report_schedule") || "off";
          if (!["off", "weekly", "monthly"].includes(schedule)) schedule = "off";
          const recipients = parseEmails(champ(form, "report_recipients"));
          await saveSettings({
            REPORT_SCHEDULE: schedule,
            REPORT_RECIPIENTS: recipients.join(","),
          });
          await audit("planification bilan PDF", schedule);
          return ok("Planification du bilan PDF enregistrée");
        }
        case "save_ct": {
          const enabled = coche(form, "ct_monitoring");
          await saveSettings({ CT_MONITORING: b(enabled) });
          await audit("config surveillance CT", `actif=${enabled ? "True" : "False"}`);
          return ok(`Surveillance Certificate Transparency ${enabled ? "activée" : "désactivée"}.`);
        }
        case "save_modules": {
          const etats: Record<string, boolean> = {};
          const coupes: string[] = [];
          for (const name of Object.keys(FEATURES) as FeatureName[]) {
            const [key, label] = FEATURES[name];
            etats[key] = coche(form, `module_${name}`);
            if (!etats[key]) coupes.push(label);
          }
          await saveSettings(Object.fromEntries(Object.entries(etats).map(([k, v]) => [k, b(v)])));
          await audit(
            "config modules",
            coupes.length ? `désactivés : ${coupes.join(", ")}` : "tous actifs",
          );
          return ok("Modules enregistrés.");
        }
        case "save_software_alerts": {
          const enabled = coche(form, "software_alerts");
          await saveSettings({ SOFTWARE_ALERTS: b(enabled) });
          await audit("config alertes logiciels", `actif=${enabled ? "True" : "False"}`);
          return ok(`Alertes logiciels ${enabled ? "activées" : "désactivées"}.`);
        }
        case "save_documents": {
          const enabled = coche(form, "documents_enabled");
          // Le plafond est borné des deux côtés : zéro rendrait tout dépôt impossible, et un chiffre sans limite ferait de la base un partage de fichiers.
          const n = Number.parseInt(champ(form, "document_max_mb") || "10", 10);
          const maxMb = Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 10;
          const apercu = coche(form, "document_inline_view");
          await saveSettings({
            DOCUMENTS_ENABLED: b(enabled),
            DOCUMENT_MAX_MB: String(maxMb),
            DOCUMENT_INLINE_VIEW: b(apercu),
          });
          await audit(
            "config pieces jointes",
            `actif=${enabled ? "True" : "False"}, max=${maxMb} Mo, apercu=${apercu ? "True" : "False"}`,
          );
          return ok(
            `Pièces jointes ${enabled ? "activées" : "désactivées"} (${maxMb} Mo maximum, aperçu ${apercu ? "activé" : "désactivé"}).`,
          );
        }
        case "save_dashboard_custom": {
          const enabled = coche(form, "dashboard_custom");
          await saveSettings({ DASHBOARD_CUSTOM: b(enabled) });
          await audit(
            "config tableau de bord personnalisable",
            `actif=${enabled ? "True" : "False"}`,
          );
          return ok(`Tableau de bord personnalisable ${enabled ? "activé" : "désactivé"}.`);
        }
        case "save_pagination_memory": {
          const enabled = coche(form, "pagination_memory");
          await saveSettings({ PAGINATION_MEMORY: b(enabled) });
          await audit("config pagination retenue", `actif=${enabled ? "True" : "False"}`);
          return ok(
            `Pagination ${enabled ? "retenue pour chaque utilisateur" : "remise à dix lignes par défaut"}.`,
          );
        }
        case "save_fiche_navigation": {
          const enabled = coche(form, "fiche_navigation");
          await saveSettings({ FICHE_NAVIGATION: b(enabled) });
          await audit("config feuilletage des fiches", `actif=${enabled ? "True" : "False"}`);
          return ok(
            `Boutons Précédent / Suivant ${enabled ? "affichés" : "masqués"} en tête des fiches.`,
          );
        }
        case "save_ui_color": {
          let color = "";
          if (coche(form, "ui_color_enabled")) {
            color = normalizeColor(champ(form, "ui_primary_color"));
            if (!color) return ko("Couleur invalide (format attendu : #rrggbb)");
          }
          await saveSettings({ UI_PRIMARY_COLOR: color });
          await audit("config couleur interface", color || "defaut");
          return ok(
            `Couleur de l'interface ${color ? `personnalisée (${color})` : "remise par défaut"}.`,
          );
        }
        case "send_report_now": {
          try {
            const sentTo = await sendReport(await getSettings());
            await audit("envoi bilan PDF", `${sentTo.length} destinataire(s)`);
            return ok(`Bilan PDF envoyé à ${sentTo.join(", ")}`);
          } catch (e) {
            return ko(`Erreur envoi bilan : ${msg(e)}`);
          }
        }
        case "test_email": {
          const addr = champ(form, "test_email") || user.email;
          try {
            await sendEmail(
              "Test de messagerie Sentinelle",
              [addr],
              "Ceci est un email de test depuis Sentinelle. Si vous recevez cet email, la configuration de messagerie est correcte.",
              "<h2>Test de messagerie Sentinelle</h2><p>Ceci est un email de test depuis <strong>Sentinelle</strong>.</p><p>Si vous recevez cet email, la configuration de messagerie est <span style='color:green'>correcte</span>.</p><hr><small>Envoye automatiquement</small>",
            );
            return ok(`Email de test envoye avec succes a ${addr}`);
          } catch (e) {
            return ko(`Erreur envoi email: ${msg(e)}`);
          }
        }
        case "save_backup_keep": {
          const n = Number.parseInt(champ(form, "backup_db_keep") || "14", 10);
          const keep = Number.isFinite(n) ? Math.max(1, Math.min(30, n)) : 14;
          await saveSettings({ BACKUP_DB_KEEP: String(keep) });
          await audit("config retention sauvegardes", `${keep} copie(s)`);
          return ok(`Rotation des sauvegardes : ${keep} copie(s) conservée(s).`);
        }
        case "backup_db": {
          try {
            const chemin = await backupDatabase(await getSettings());
            await audit("sauvegarde base", path.basename(chemin), "base");
            return ok(`Base sauvegardee : ${path.basename(chemin)}`);
          } catch (e) {
            return ko(`Erreur sauvegarde base : ${msg(e)}`);
          }
        }
        case "delete_db_backup": {
          const name = champ(form, "name");
          try {
            await deleteBackup(await getSettings(), name);
            await audit("suppression sauvegarde base", name, "base");
            return ok("Sauvegarde supprimee");
          } catch (e) {
            return ko(`Suppression impossible : ${msg(e)}`);
          }
        }
        case "save_ldap": {
          const enabled = coche(form, "ldap_enabled");
          const useSsl = coche(form, "ldap_ssl");
          const validate = coche(form, "ldap_validate_cert");
          const port = champ(form, "ldap_port") || "389";
          // Certificat CA : chemin saisi, ou fichier importé (prioritaire).
          let caPath = champ(form, "ldap_ca_cert");
          const caFile = form.get("ldap_ca_cert_file");
          if (caFile && typeof caFile !== "string" && caFile.name) {
            const instance = path.join(process.cwd(), "instance");
            await fs.mkdir(instance, { recursive: true });
            const dest = path.join(instance, "ldap_ca.pem");
            await fs.writeFile(dest, Buffer.from(await caFile.arrayBuffer()));
            caPath = dest;
            await flash(`Certificat CA importé (${caFile.name}).`, "info");
          }
          const updates: Record<string, string> = {
            LDAP_ENABLED: b(enabled),
            LDAP_SERVER: champ(form, "ldap_server"),
            LDAP_PORT: port,
            LDAP_USE_SSL: b(useSsl),
            LDAP_VALIDATE_CERT: b(validate),
            LDAP_CA_CERT: caPath,
            LDAP_DOMAIN: champ(form, "ldap_domain"),
            LDAP_BASE_DN: champ(form, "ldap_base_dn"),
            LDAP_REQUIRED_GROUP: champ(form, "ldap_required_group"),
            LDAP_DEFAULT_ROLE: champ(form, "ldap_default_role") || "viewer",
            LDAP_BIND_USER: champ(form, "ldap_bind_user"),
          };
          const bindPw = String(form.get("ldap_bind_password") ?? "");
          if (bindPw) updates.LDAP_BIND_PASSWORD = bindPw;
          await saveSettings(updates);
          await audit("config LDAP", `actif=${enabled ? "True" : "False"}`);
          return ok("Configuration LDAP enregistree");
        }
        case "save_thresholds": {
          const parse3 = (
            prefix: string,
            def: [number, number, number],
          ): [number, number, number] => {
            const out = (["danger", "warning", "info"] as const).map((k, i) => {
              const n = Number.parseInt(champ(form, `${prefix}_${k}`), 10);
              return Number.isFinite(n) ? Math.max(0, n) : def[i];
            });
            return [out[0], out[1], out[2]];
          };
          const groups = {
            THRESHOLD_EXPIRY: parse3("expiry", [7, 15, 30]),
            THRESHOLD_DOMAIN: parse3("domain", [30, 60, 90]),
            THRESHOLD_TASK: parse3("task", [7, 15, 30]),
            THRESHOLD_CONTRACT: parse3("contract", [60, 90, 180]),
          };
          await saveSettings(
            Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.join(",")])),
          );
          await audit("config seuils alertes");
          return ok("Seuils d'alerte enregistres");
        }
        case "send_digest": {
          const addr = champ(form, "test_email") || user.email;
          const cfg = await getSettings();
          const digest = await buildDailyDigest(cfg.APP_BASE_URL || "");
          try {
            await sendEmail(digest.subject, [addr], digest.text, digest.html, undefined, cfg);
            return ok(`Recapitulatif envoye a ${addr}`);
          } catch (e) {
            return ko(`Erreur envoi recap: ${msg(e)}`);
          }
        }
        case "save_conformity": {
          await setConformityCategories(form.getAll("conformity").map(String));
          await audit("config conformite", "Conformite globale");
          return ok("Catégories de la conformité globale enregistrées");
        }
        case "test_ldap": {
          const [reussi, message] = await testLdapConnection(await getSettings());
          return redirigerAvecMessage(PREFS, message, reussi ? "success" : "danger");
        }
        default:
          return redirection(PREFS);
      }
    },
    PREFS,
  );
}
