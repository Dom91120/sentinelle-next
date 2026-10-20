/** Espace « Connecteurs » : page dédiée, activation et clé Sesame, webhooks (port de tests/test_connectors.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { ClientTest, clientAdmin } from "./setup/client";
import { creerUtilisateur, prisma, reglage, regler, resetDb } from "./setup/db";

beforeEach(resetDb);

describe("connecteurs", () => {
  it("page connecteurs (admin)", async () => {
    const c = await clientAdmin();
    const r = await c.get("/connecteurs");
    expect(r.status).toBe(200);
    expect(r.text).toContain("Connecteurs");
    expect(r.text).toContain("Sesame");
  });

  it("activation du connecteur Sesame", async () => {
    const c = await clientAdmin();
    await regler({ SESAME_API_ENABLED: false });
    const r = await c.post(
      "/connecteurs/sesame",
      { action: "save", sesame_enabled: "on" },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    expect(await reglage("SESAME_API_ENABLED")).toBe(true);
    await c.post("/connecteurs/sesame", { action: "save" }, { followRedirects: true });
    expect(await reglage("SESAME_API_ENABLED")).toBe(false);
  });

  it("génération de la clé Sesame", async () => {
    const c = await clientAdmin();
    const r = await c.post(
      "/connecteurs/sesame",
      { action: "generate_key" },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    const token = await reglage<string>("SESAME_API_TOKEN");
    expect(token.length).toBeGreaterThanOrEqual(20);
    expect(r.text).toContain(token); // affichée une seule fois
  });

  it("la page porte les webhooks", async () => {
    const c = await clientAdmin();
    const body = (await c.get("/connecteurs")).text;
    expect(body).toContain("Notifications (webhooks)");
    expect(body).toContain("teams_webhook");
    expect(body).toContain("wh_url");
  });

  it("enregistrement des webhooks globaux", async () => {
    const c = await clientAdmin();
    const r = await c.post(
      "/connecteurs/webhooks",
      {
        action: "save_webhooks",
        teams_webhook: "https://teams.example/hook",
        slack_webhook: "",
        discord_webhook: "",
      },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    expect(await reglage("TEAMS_WEBHOOK_URL")).toBe("https://teams.example/hook");
  });

  it("ajout et suppression d'un webhook par catégorie", async () => {
    const c = await clientAdmin();
    const r = await c.post(
      "/connecteurs/webhooks",
      {
        action: "add_webhook",
        wh_category: "all",
        wh_channel: "slack",
        wh_url: "https://hooks.slack.com/services/xxx",
        wh_label: "Général",
      },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    const w = await prisma.webhook.findFirst({ where: { channel: "slack" } });
    expect(w?.category).toBe("all");
    // URL non https refusée
    await c.post(
      "/connecteurs/webhooks",
      {
        action: "add_webhook",
        wh_category: "all",
        wh_channel: "teams",
        wh_url: "http://interne/hook",
      },
      { followRedirects: true },
    );
    expect(await prisma.webhook.findFirst({ where: { channel: "teams" } })).toBeNull();
    await c.post(
      "/connecteurs/webhooks",
      { action: "delete_webhook", wh_id: String(w?.id) },
      { followRedirects: true },
    );
    expect(await prisma.webhook.findUnique({ where: { id: w?.id ?? 0 } })).toBeNull();
  });

  it("les préférences ne contiennent plus les webhooks", async () => {
    const c = await clientAdmin();
    const body = (await c.get("/preferences")).text;
    expect(body).not.toContain("teams_webhook");
    expect(body).not.toContain("wh_url");
  });

  it("réservé aux admins", async () => {
    await creerUtilisateur("lecteur", "x", "viewer");
    const c = new ClientTest();
    await c.login("lecteur", "x");
    const r = await c.get("/connecteurs");
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.status).toBeLessThan(400);
  });

  it("la page annonce Sesame, plus le parc", async () => {
    const c = await clientAdmin();
    const body = (await c.get("/connecteurs")).text;
    expect(body).toContain("Sesame");
    expect(body).toContain("sesame_enabled");
    expect(body).toContain("/api/assets");
    expect(body).not.toContain("/api/equipment");
    expect(body).not.toContain("SoftInventory");
  });

  it("le parc n'est plus exposé", async () => {
    const c = await clientAdmin();
    expect((await c.get("/api/equipment")).status).toBe(404);
    expect((await c.post("/connecteurs/softinventory", { action: "generate_key" })).status).toBe(
      404,
    );
  });
});
