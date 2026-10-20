/**
 * Envoi des e-mails (port de app/email_service.py) : SMTP (Nodemailer) ou
 * Microsoft Graph (Office 365, MSAL). La configuration vivante vient de
 * Préférences (config-store), le jeton O365 est chiffré en base (AppConfig).
 */
import nodemailer from "nodemailer";
import { type AppSettings, getSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { journal } from "@/server/log";
import { decryptSecret, encryptSecret } from "@/server/secret-crypto";

export type Attachment = { filename: string; content: Buffer; contentType?: string };

/** L'envoi des mails est coupé dans Préférences (MAIL_ENABLED). */
export class MailDisabled extends Error {
  constructor() {
    super("Envoi des mails désactivé dans Préférences.");
    this.name = "MailDisabled";
  }
}

// ── Jeton Office 365 (chiffré, clé app_config O365_TOKEN) ──
const TOKEN_KEY = "O365_TOKEN";
type TokenData = { access_token: string; refresh_token: string; user_email: string };

async function loadToken(): Promise<TokenData | null> {
  const row = await prisma.appConfig.findUnique({ where: { key: TOKEN_KEY } });
  if (!row?.value) return null;
  try {
    return JSON.parse(decryptSecret(row.value)) as TokenData;
  } catch {
    return null;
  }
}

async function saveToken(accessToken: string, refreshToken: string, userEmail = ""): Promise<void> {
  const payload = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    user_email: userEmail,
  });
  await prisma.appConfig.upsert({
    where: { key: TOKEN_KEY },
    update: { value: encryptSecret(payload), isSecret: true },
    create: { key: TOKEN_KEY, value: encryptSecret(payload), isSecret: true },
  });
}

export async function clearO365Token(): Promise<void> {
  await prisma.appConfig.deleteMany({ where: { key: TOKEN_KEY } });
}

export async function isO365Connected(): Promise<boolean> {
  const t = await loadToken();
  return Boolean(t?.refresh_token);
}

export async function getO365UserEmail(): Promise<string> {
  return (await loadToken())?.user_email ?? "";
}

type MsalApp = import("@azure/msal-node").ConfidentialClientApplication;

async function msalApp(cfg: AppSettings): Promise<MsalApp> {
  const { ConfidentialClientApplication } = await import("@azure/msal-node");
  return new ConfidentialClientApplication({
    auth: {
      clientId: cfg.O365_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${cfg.O365_TENANT_ID}`,
      clientSecret: cfg.O365_CLIENT_SECRET,
    },
  });
}

const SCOPES = ["Mail.Send", "User.Read"];

/** URL d'autorisation OAuth2 (null si la configuration est incomplète). */
export async function getO365AuthUrl(cfg: AppSettings, state: string): Promise<string | null> {
  if (!cfg.O365_CLIENT_ID || !cfg.O365_TENANT_ID) return null;
  const app = await msalApp(cfg);
  return app.getAuthCodeUrl({ scopes: SCOPES, redirectUri: cfg.O365_REDIRECT_URI, state });
}

/** Termine le flux OAuth2 : échange le code, mémorise le jeton, renvoie l'adresse de l'émetteur. */
export async function completeO365Auth(cfg: AppSettings, code: string): Promise<string> {
  const app = await msalApp(cfg);
  const result = await app.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: cfg.O365_REDIRECT_URI,
  });
  if (!result?.accessToken) throw new Error("Erreur OAuth2 : aucun jeton reçu.");
  let userEmail = "";
  try {
    const r = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${result.accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (r.ok) {
      const data = (await r.json()) as { mail?: string; userPrincipalName?: string };
      userEmail = data.mail || data.userPrincipalName || "";
    } else {
      journal.avert("o365", "Récupération de l'email émetteur échouée", { statut: r.status });
    }
  } catch (e) {
    journal.avert("o365", "Récupération de l'email émetteur échouée", { erreur: e });
  }
  // MSAL Node ne renvoie pas le refresh token en clair : on conserve le cache de
  // jetons sérialisé, et on en extrait le refresh token pour les envois suivants.
  const cache = app.getTokenCache().serialize();
  const refresh = extractRefreshToken(cache);
  await saveToken(result.accessToken, refresh, userEmail);
  return userEmail;
}

function extractRefreshToken(serializedCache: string): string {
  try {
    const parsed = JSON.parse(serializedCache) as {
      RefreshToken?: Record<string, { secret?: string }>;
    };
    const entries = Object.values(parsed.RefreshToken ?? {});
    return entries[0]?.secret ?? "";
  } catch {
    return "";
  }
}

async function getO365AccessToken(cfg: AppSettings): Promise<string | null> {
  const token = await loadToken();
  if (!token?.refresh_token) return null;
  const app = await msalApp(cfg);
  try {
    const result = await app.acquireTokenByRefreshToken({
      refreshToken: token.refresh_token,
      scopes: ["Mail.Send"],
    });
    if (result?.accessToken) {
      const cache = app.getTokenCache().serialize();
      const newRefresh = extractRefreshToken(cache) || token.refresh_token;
      await saveToken(result.accessToken, newRefresh, token.user_email);
      return result.accessToken;
    }
  } catch (e) {
    journal.avert("o365", "Renouvellement du jeton échoué", { erreur: e });
  }
  await clearO365Token();
  return null;
}

// ── Envoi ──

export async function sendEmail(
  subject: string,
  recipients: string[],
  body: string,
  htmlBody?: string | null,
  attachments?: Attachment[],
  cfgIn?: AppSettings,
): Promise<boolean> {
  const cfg = cfgIn ?? (await getSettings());
  if (!cfg.MAIL_ENABLED) throw new MailDisabled();
  if (cfg.MAIL_METHOD === "o365")
    return sendViaGraph(cfg, subject, recipients, body, htmlBody, attachments);
  return sendViaSmtp(cfg, subject, recipients, body, htmlBody, attachments);
}

async function sendViaSmtp(
  cfg: AppSettings,
  subject: string,
  recipients: string[],
  body: string,
  htmlBody?: string | null,
  attachments?: Attachment[],
): Promise<boolean> {
  const server = cfg.MAIL_SERVER;
  const port = Number(cfg.MAIL_PORT) || 25;
  const useTls = cfg.MAIL_USE_TLS;
  const user = (cfg.MAIL_USERNAME || "").trim();
  const password = cfg.MAIL_PASSWORD || "";
  const sender = (cfg.MAIL_DEFAULT_SENDER || "").trim() || user;
  if (!server) throw new Error("Aucun serveur SMTP configure dans Preferences.");
  if (!sender) throw new Error("Aucune adresse expeditrice configuree dans Preferences.");
  const to = recipients.map((r) => r.trim()).filter(Boolean);
  if (!to.length) throw new Error("Aucun destinataire.");
  const transport = nodemailer.createTransport({
    host: server,
    port,
    secure: port === 465,
    requireTLS: useTls && port !== 465,
    // Nom de machine ASCII pour le EHLO (un nom accentué faisait planter l'envoi).
    name: "sentinelle",
    auth: user && password ? { user, pass: password } : undefined,
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 30_000,
  });
  await transport.sendMail({
    from: sender,
    to: to.join(", "),
    subject: `[Sentinelle] ${subject}`,
    text: body,
    html: htmlBody ?? undefined,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType ?? "application/octet-stream",
    })),
  });
  return true;
}

async function sendViaGraph(
  cfg: AppSettings,
  subject: string,
  recipients: string[],
  body: string,
  htmlBody?: string | null,
  attachments?: Attachment[],
): Promise<boolean> {
  const accessToken = await getO365AccessToken(cfg);
  if (!accessToken) throw new Error("Token O365 expire. Reconnectez-vous via Preferences.");
  const sender = cfg.O365_SENDER_EMAIL;
  if (!sender) throw new Error("Email emetteur non configure.");
  const message: Record<string, unknown> = {
    subject: `[Sentinelle] ${subject}`,
    body: { contentType: htmlBody ? "HTML" : "Text", content: htmlBody || body },
    toRecipients: recipients
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => ({ emailAddress: { address: r } })),
  };
  if (attachments?.length) {
    message.attachments = attachments.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.filename,
      contentType: a.contentType ?? "application/octet-stream",
      contentBytes: a.content.toString("base64"),
    }));
  }
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (r.status !== 200 && r.status !== 202) {
    throw new Error(`Envoi echoue (HTTP ${r.status}): ${await r.text()}`);
  }
  return true;
}

// ── Habillage HTML des alertes ──
const STATUS_COLORS: Record<string, string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  success: "#10b981",
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Habille un message d'alerte en HTML (charte Sentinelle, barre de statut). */
export function renderAlertEmail(
  title: string,
  body: string,
  status = "danger",
  url?: string | null,
): string {
  const bar = STATUS_COLORS[status] ?? "#4f46e5";
  const bodyHtml = escapeHtml(body).replace(/\n/g, "<br>");
  const button = url
    ? `<div style="margin-top:18px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:14px;font-weight:600;">Voir la fiche &rarr;</a></div>`
    : "";
  return (
    '<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#334155;">' +
    '<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">' +
    '<div style="background:linear-gradient(135deg,#6366f1,#3b82f6);padding:16px 24px;color:#fff;font-size:18px;font-weight:700;letter-spacing:.5px;">&#128737; Sentinelle</div>' +
    `<div style="height:4px;background:${bar};"></div>` +
    '<div style="padding:24px;">' +
    `<h2 style="margin:0 0 12px;font-size:18px;color:#1e293b;">${escapeHtml(title)}</h2>` +
    `<div style="font-size:14px;line-height:1.6;">${bodyHtml}</div>` +
    button +
    "</div>" +
    '<div style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;">Message automatique — Sentinelle, supervision DSI.</div>' +
    "</div></body></html>"
  );
}
