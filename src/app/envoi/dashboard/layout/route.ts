import {
  DASHBOARD_WIDGETS,
  loadPrefs,
  STAT_CARDS,
  WIDGET_SPAN_MAX,
  WIDGET_SPAN_MIN,
} from "@/server/dashboard";
import { prisma } from "@/server/db";
import { reponseApi, requireUserApi } from "@/server/guards";
import { json, verifierCsrf } from "@/server/http";

/** POST /dashboard/layout (dashboard.save_layout) : disposition personnalisée, en JSON. */
export async function POST(req: Request) {
  return reponseApi(async () => {
    const user = await requireUserApi();
    if (!(await verifierCsrf(req, null))) return json({ ok: false, error: "csrf" }, 400);
    if (!user.settings.DASHBOARD_CUSTOM) return json({ ok: false, error: "disabled" }, 403);
    let data: Record<string, unknown> = {};
    try {
      data = (await req.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }
    if (data.reset) {
      await prisma.user.update({ where: { id: user.id }, data: { dashboardPrefs: null } });
      return json({ ok: true });
    }
    const valid = new Set(DASHBOARD_WIDGETS.map((w) => w.key));
    const liste = (v: unknown) =>
      Array.isArray(v) ? v.filter((k): k is string => typeof k === "string" && valid.has(k)) : [];
    const order = liste(data.order);
    const hidden = liste(data.hidden);
    const spans: Record<string, number> = {};
    const rawSpans = data.spans;
    for (const [key, val] of Object.entries(
      rawSpans && typeof rawSpans === "object" ? (rawSpans as Record<string, unknown>) : {},
    )) {
      if (!valid.has(key)) continue;
      const n = Number.parseInt(String(val), 10);
      if (Number.isInteger(n) && n >= WIDGET_SPAN_MIN && n <= WIDGET_SPAN_MAX) spans[key] = n;
    }
    const validCards = new Set(STAT_CARDS.map((c) => c.key));
    const prev = loadPrefs(user);
    const cardsListe = (v: unknown, repli: string[] | undefined) =>
      Array.isArray(v)
        ? v.filter((k): k is string => typeof k === "string" && validCards.has(k))
        : (repli ?? []).filter((k) => validCards.has(k));
    const hiddenCards = cardsListe(data.hidden_cards, prev.hidden_cards);
    const hiddenSet = new Set(hiddenCards);
    const cards = cardsListe(data.cards, prev.cards).filter((k) => !hiddenSet.has(k));
    await prisma.user.update({
      where: { id: user.id },
      data: {
        dashboardPrefs: JSON.stringify({ order, hidden, spans, cards, hidden_cards: hiddenCards }),
      },
    });
    return json({ ok: true });
  });
}
