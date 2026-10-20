/**
 * Payloads de notification webhook (Teams surtout), port de tests/test_notify.py :
 * Workflow (Power Automate) → Adaptive Card ; ancien connecteur O365 → MessageCard.
 */
import { describe, expect, it } from "vitest";
import { sendTo, teamsPayload } from "./notify";

describe("notify", () => {
  it("une URL Workflow Teams produit une Adaptive Card", () => {
    const url =
      "https://prod-1.francecentral.logic.azure.com/workflows/a/triggers/manual/paths/invoke";
    const payload = teamsPayload("Sujet", "Corps", "danger", "https://s/fiche/1", url) as {
      type: string;
      attachments: {
        contentType: string;
        content: {
          type: string;
          body: { color: string }[];
          actions: { type: string; url: string }[];
        };
      }[];
    };
    expect(payload.type).toBe("message");
    const att = payload.attachments[0];
    expect(att.contentType).toBe("application/vnd.microsoft.card.adaptive");
    expect(att.content.type).toBe("AdaptiveCard");
    expect(att.content.body[0].color).toBe("attention");
    expect(att.content.actions[0].type).toBe("Action.OpenUrl");
    expect(att.content.actions[0].url).toBe("https://s/fiche/1");
  });

  it("l'ancien connecteur produit une MessageCard", () => {
    const url = "https://contoso.webhook.office.com/webhookb2/xyz@tid/IncomingWebhook/abc";
    const payload = teamsPayload("Sujet", "Corps", "warning", null, url);
    expect(payload["@type"]).toBe("MessageCard");
    expect(payload.themeColor).toBe("F59E0B");
  });

  it("une URL inconnue vise le format pérenne (Adaptive Card)", () => {
    expect(teamsPayload("Sujet", "Corps", "info", null, "https://exemple.test/hook").type).toBe(
      "message",
    );
  });

  it("send_to Teams utilise le bon format", async () => {
    let capture: unknown = null;
    const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
      capture = JSON.parse(String(init?.body));
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const ok = await sendTo(
      "teams",
      "https://x.logic.azure.com/workflows/i",
      "S",
      "B",
      "success",
      null,
      fetcher,
    );
    expect(ok).toBe(true);
    expect((capture as { type: string }).type).toBe("message");
  });
});
