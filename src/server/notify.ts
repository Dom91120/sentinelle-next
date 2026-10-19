/**
 * Notifications multi-canaux (Microsoft Teams, Slack, Discord) via webhooks —
 * port de app/notify.py. Toutes best-effort : aucune exception ne remonte.
 */
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";
import { journal } from "@/server/log";

const HEX: Record<string, string> = { danger: "EF4444", warning: "F59E0B", info: "3B82F6", success: "10B981" };
const color = (status: string) => HEX[status] ?? "4F46E5";
const AC_COLOR: Record<string, string> = { danger: "attention", warning: "warning", info: "accent", success: "good" };

export type Payload = Record<string, unknown>;

async function post(url: string, payload: Payload, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const r = await fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    if (![200, 202, 204].includes(r.status)) {
      journal.avert("notify", "Notification webhook HTTP", { statut: r.status });
      return false;
    }
    return true;
  } catch (e) {
    journal.avert("notify", "Envoi notification échoué", { erreur: e });
    return false;
  }
}

/** Vrai si l'URL est un ancien connecteur O365 (déprécié) et non un Workflow. */
export function isLegacyTeams(webhookUrl: string | null | undefined): boolean {
  const u = webhookUrl ?? "";
  return u.includes("webhook.office.com") || u.includes("outlook.office.com");
}

export function teamsCardLegacy(subject: string, body: string, status: string, url?: string | null): Payload {
  const card: Payload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: color(status),
    summary: subject,
    title: `[Sentinelle] ${subject}`,
    text: (body || "").replace(/\n/g, "\n\n"),
  };
  if (url) {
    card.potentialAction = [{ "@type": "OpenUri", name: "Voir la fiche", targets: [{ os: "default", uri: url }] }];
  }
  return card;
}

export function teamsCardWorkflow(subject: string, body: string, status: string, url?: string | null): Payload {
  const blocks: Payload[] = [
    {
      type: "TextBlock",
      text: `[Sentinelle] ${subject}`,
      weight: "Bolder",
      size: "Large",
      wrap: true,
      color: AC_COLOR[status] ?? "default",
    },
  ];
  if (body) blocks.push({ type: "TextBlock", text: body, wrap: true });
  const card: Payload = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: blocks,
  };
  if (url) card.actions = [{ type: "Action.OpenUrl", title: "Voir la fiche", url }];
  return { type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: card }] };
}

export function teamsPayload(subject: string, body: string, status: string, url?: string | null, webhookUrl?: string | null): Payload {
  return isLegacyTeams(webhookUrl) ? teamsCardLegacy(subject, body, status, url) : teamsCardWorkflow(subject, body, status, url);
}

export function slackPayload(subject: string, body: string, status: string, url?: string | null): Payload {
  let text = body || "";
  if (url) text += `\n<${url}|Voir la fiche>`;
  return { attachments: [{ color: `#${color(status)}`, title: `[Sentinelle] ${subject}`, text, mrkdwn_in: ["text"] }] };
}

export function discordPayload(subject: string, body: string, status: string, url?: string | null): Payload {
  const embed: Payload = { title: `[Sentinelle] ${subject}`, description: body || "", color: Number.parseInt(color(status), 16) };
  if (url) embed.url = url;
  return { embeds: [embed] };
}

/** Envoie sur un canal donné (teams/slack/discord) vers une URL précise. */
export async function sendTo(
  channel: string,
  webhookUrl: string | null | undefined,
  subject: string,
  body: string,
  status = "danger",
  url?: string | null,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!webhookUrl) return false;
  let payload: Payload;
  if (channel === "teams") payload = teamsPayload(subject, body, status, url, webhookUrl);
  else if (channel === "slack") payload = slackPayload(subject, body, status, url);
  else if (channel === "discord") payload = discordPayload(subject, body, status, url);
  else return false;
  return post(webhookUrl, payload, fetcher);
}

/** Diffuse vers les webhooks globaux (config) et ceux de la catégorie (+ 'all'). Retourne le nombre d'envois réussis. */
export async function notifyAll(
  cfg: AppSettings,
  subject: string,
  body: string,
  status = "danger",
  url?: string | null,
  category?: string | null,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  let sent = 0;
  for (const [channel, key] of [
    ["teams", "TEAMS_WEBHOOK_URL"],
    ["slack", "SLACK_WEBHOOK_URL"],
    ["discord", "DISCORD_WEBHOOK_URL"],
  ] as const) {
    try {
      if (await sendTo(channel, cfg[key], subject, body, status, url, fetcher)) sent += 1;
    } catch {
      // best-effort
    }
  }
  try {
    const cats = ["all", ...(category ? [category] : [])];
    const rows = await prisma.webhook.findMany({ where: { isActive: true, category: { in: cats } } });
    for (const w of rows) {
      try {
        if (await sendTo(w.channel, w.url, subject, body, status, url, fetcher)) sent += 1;
      } catch {
        // best-effort
      }
    }
  } catch {
    // best-effort
  }
  return sent;
}
