/** API Sesame (GET /api/assets) : activation, clé Bearer, format (port de tests/test_api_sesame.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { ClientTest } from "./setup/client";
import { prisma, regler, resetDb } from "./setup/db";

beforeEach(resetDb);

async function seedAssets() {
  await prisma.software.create({
    data: {
      name: "Zabbix",
      description: "Supervision",
      responsible: "DSI",
      responsibleEmail: "dsi@ex.fr",
    },
  });
  await prisma.software.create({ data: { name: "GLPI", description: "Parc" } });
}

const bearer = (cle: string) => ({ headers: { Authorization: `Bearer ${cle}` } });

describe("API Sesame", () => {
  it("désactivée : 503", async () => {
    await regler({ SESAME_API_ENABLED: false, SESAME_API_TOKEN: "k" });
    expect((await new ClientTest().get("/api/assets")).status).toBe(503);
  });

  it("sans clé ou mauvaise clé : 401", async () => {
    await regler({ SESAME_API_ENABLED: true, SESAME_API_TOKEN: "bonne-cle" });
    const c = new ClientTest();
    expect((await c.get("/api/assets")).status).toBe(401);
    expect((await c.get("/api/assets", bearer("mauvaise"))).status).toBe(401);
  });

  it("non configurée : 503", async () => {
    await regler({ SESAME_API_ENABLED: true, SESAME_API_TOKEN: "" });
    expect((await new ClientTest().get("/api/assets", bearer("x"))).status).toBe(503);
  });

  it("liste des applications triée", async () => {
    await seedAssets();
    await regler({ SESAME_API_ENABLED: true, SESAME_API_TOKEN: "bonne-cle" });
    const r = await new ClientTest().get("/api/assets?type=application", bearer("bonne-cle"));
    expect(r.status).toBe(200);
    const data = r.json<Record<string, unknown>[]>();
    expect(data.map((a) => a.name)).toEqual(["GLPI", "Zabbix"]);
    expect(new Set(Object.keys(data[0]))).toEqual(
      new Set(["id", "name", "description", "is_active", "responsible", "responsible_email"]),
    );
    expect(data[0].is_active).toBe(true);
    const zabbix = data.find((x) => x.name === "Zabbix");
    expect(zabbix?.responsible).toBe("DSI");
    expect(zabbix?.responsible_email).toBe("dsi@ex.fr");
    expect(data[0].responsible_email).toBe("");
  });

  it("type inconnu : liste vide", async () => {
    await seedAssets();
    await regler({ SESAME_API_ENABLED: true, SESAME_API_TOKEN: "bonne-cle" });
    const r = await new ClientTest().get("/api/assets?type=system", bearer("bonne-cle"));
    expect(r.status).toBe(200);
    expect(r.json()).toEqual([]);
  });

  it("sans filtre type : tout", async () => {
    await seedAssets();
    await regler({ SESAME_API_ENABLED: true, SESAME_API_TOKEN: "bonne-cle" });
    const r = await new ClientTest().get("/api/assets", bearer("bonne-cle"));
    expect(r.status).toBe(200);
    expect(new Set(r.json<{ name: string }[]>().map((a) => a.name))).toEqual(
      new Set(["GLPI", "Zabbix"]),
    );
  });
});
