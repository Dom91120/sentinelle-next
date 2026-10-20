/** Tableau de bord personnalisable : résolution ordre/visibilité + persistance (port de tests/test_dashboard_layout.py). */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DASHBOARD_WIDGETS,
  resolveCardLayout,
  resolveCardOrder,
  resolveDashboardLayout,
  resolveWidgetSpans,
  STAT_CARDS,
  WIDGET_SPAN_DEFAULT,
} from "@/server/dashboard";
import { clientAdmin } from "./setup/client";
import { admin, prisma, regler, resetDb } from "./setup/db";

const ALL_KEYS = DASHBOARD_WIDGETS.map((w) => w.key);
const ALL_CARDS = STAT_CARDS.map((c) => c.key);
const u = (prefs: string | null) => ({ dashboardPrefs: prefs });

describe("résolution pure", () => {
  it("disposition par défaut sans préférences", () => {
    expect(resolveDashboardLayout(u(null), ALL_KEYS)).toEqual([ALL_KEYS, []]);
  });
  it("réordonne et masque", () => {
    expect(
      resolveDashboardLayout(
        u(JSON.stringify({ order: ["stats", "conformity"], hidden: ["alerts"] })),
        ["conformity", "stats", "alerts"],
      ),
    ).toEqual([["stats", "conformity"], ["alerts"]]);
  });
  it("un nouveau bloc est visible par défaut", () => {
    const [visible, hidden] = resolveDashboardLayout(
      u(JSON.stringify({ order: ["stats"], hidden: ["alerts"] })),
      ["stats", "alerts", "attention"],
    );
    expect(visible.at(-1)).toBe("attention");
    expect(hidden).toEqual(["alerts"]);
  });
  it("ignore les clés indisponibles", () => {
    expect(
      resolveDashboardLayout(
        u(JSON.stringify({ order: ["alerts", "stats"], hidden: ["conformity"] })),
        ["stats"],
      ),
    ).toEqual([["stats"], []]);
  });
  it("préférences corrompues : repli défaut", () => {
    expect(resolveDashboardLayout(u("{pas du json"), ALL_KEYS)).toEqual([ALL_KEYS, []]);
  });
  it("largeurs par défaut et surcharge bornée", () => {
    expect(resolveWidgetSpans(u(null))).toEqual(WIDGET_SPAN_DEFAULT);
    const spans = resolveWidgetSpans(
      u(
        JSON.stringify({
          spans: { stats: 6, attention: 99, upcoming: 1, alerts: "x", inconnu: 4 },
        }),
      ),
    );
    expect(spans.stats).toBe(6);
    expect(spans.attention).toBe(WIDGET_SPAN_DEFAULT.attention);
    expect(spans.upcoming).toBe(WIDGET_SPAN_DEFAULT.upcoming);
    expect(spans.alerts).toBe(WIDGET_SPAN_DEFAULT.alerts);
    expect(spans).not.toHaveProperty("inconnu");
  });
  it("ordre des vignettes : défaut, respecté et complété, indisponibles ignorées", () => {
    expect(resolveCardOrder(u(null), ALL_CARDS)).toEqual(ALL_CARDS);
    const order = resolveCardOrder(u(JSON.stringify({ cards: ["contracts", "accounts"] })), [
      "accounts",
      "certificates",
      "contracts",
    ]);
    expect(order.slice(0, 2)).toEqual(["contracts", "accounts"]);
    expect(order.at(-1)).toBe("certificates");
    expect(
      resolveCardOrder(u(JSON.stringify({ cards: ["inventory", "accounts"] })), ["accounts"]),
    ).toEqual(["accounts"]);
  });
  it("vignettes masquées", () => {
    const [visible, hidden] = resolveCardLayout(
      u(JSON.stringify({ cards: ["certificates", "accounts"], hidden_cards: ["accounts"] })),
      ["accounts", "certificates", "contracts"],
    );
    expect(hidden).toEqual(["accounts"]);
    expect(visible).not.toContain("accounts");
    expect(visible[0]).toBe("certificates");
    expect(visible.at(-1)).toBe("contracts");
    expect(
      resolveCardLayout(u(JSON.stringify({ cards: ["accounts"], hidden_cards: ["inventory"] })), [
        "accounts",
      ]),
    ).toEqual([["accounts"], []]);
  });
});

describe("persistance", () => {
  beforeEach(resetDb);
  const prefs = async () => JSON.parse((await admin()).dashboardPrefs ?? "null");

  it("la disposition est persistée pour l'utilisateur", async () => {
    const c = await clientAdmin();
    const r = await c.postJson("/dashboard/layout", {
      order: ["stats", "conformity"],
      hidden: ["alerts", "inconnu"],
    });
    expect(r.status).toBe(200);
    expect(r.json<{ ok: boolean }>().ok).toBe(true);
    const saved = await prefs();
    expect(saved.order).toEqual(["stats", "conformity"]);
    expect(saved.hidden).toEqual(["alerts"]);
  });

  it("les largeurs sont persistées", async () => {
    const c = await clientAdmin();
    expect(
      (
        await c.postJson("/dashboard/layout", {
          order: ["stats"],
          hidden: [],
          spans: { stats: 6, attention: 42, inconnu: 8 },
        })
      ).status,
    ).toBe(200);
    expect((await prefs()).spans).toEqual({ stats: 6 });
  });

  it("vignettes masquées persistées", async () => {
    const c = await clientAdmin();
    expect(
      (
        await c.postJson("/dashboard/layout", {
          order: ["stats"],
          hidden: [],
          cards: ["accounts", "certificates", "inconnu"],
          hidden_cards: ["certificates", "inconnu"],
        })
      ).status,
    ).toBe(200);
    const saved = await prefs();
    expect(saved.hidden_cards).toEqual(["certificates"]);
    expect(saved.cards).toEqual(["accounts"]);
  });

  it("ordre des vignettes persisté", async () => {
    const c = await clientAdmin();
    expect(
      (
        await c.postJson("/dashboard/layout", {
          order: ["stats"],
          hidden: [],
          cards: ["contracts", "accounts", "inconnu"],
        })
      ).status,
    ).toBe(200);
    expect((await prefs()).cards).toEqual(["contracts", "accounts"]);
  });

  it("reset", async () => {
    const c = await clientAdmin();
    await prisma.user.update({
      where: { id: (await admin()).id },
      data: { dashboardPrefs: JSON.stringify({ order: ["stats"], hidden: [] }) },
    });
    expect((await c.postJson("/dashboard/layout", { reset: true })).status).toBe(200);
    expect((await admin()).dashboardPrefs).toBeNull();
  });

  it("désactivé globalement : 403", async () => {
    const c = await clientAdmin();
    await regler({ DASHBOARD_CUSTOM: false });
    expect((await c.postJson("/dashboard/layout", { order: ["stats"], hidden: [] })).status).toBe(
      403,
    );
  });
});
