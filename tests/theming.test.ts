/** Couleur principale personnalisable : logo teinté, surcharge CSS, enregistrement (port de tests/test_theming.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { ClientTest, clientAdmin } from "./setup/client";
import { reglage, regler, resetDb } from "./setup/db";

beforeEach(resetDb);

describe("apparence", () => {
  it("logo teinté", async () => {
    const c = new ClientTest();
    expect((await c.get("/logo.svg")).text).toContain("#4f46e5");
    await regler({ UI_PRIMARY_COLOR: "#0d9488" });
    const body = (await c.get("/logo.svg")).text;
    expect(body).toContain("#0d9488");
    expect(body).not.toContain("#4f46e5");
  });

  it("pas de surcharge par défaut", async () => {
    const c = await clientAdmin();
    expect((await c.get("/preferences")).text).not.toContain("--primary:#");
  });

  it("enregistrement et application", async () => {
    const c = await clientAdmin();
    const r = await c.post(
      "/preferences",
      { action: "save_ui_color", ui_color_enabled: "on", ui_primary_color: "#0D9488" },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    expect(await reglage("UI_PRIMARY_COLOR")).toBe("#0d9488");
    expect((await c.get("/preferences")).text).toContain("--primary:#0d9488");
    // Couleur invalide → refusée, la config ne bouge pas.
    await c.post(
      "/preferences",
      { action: "save_ui_color", ui_color_enabled: "on", ui_primary_color: "vert" },
      { followRedirects: true },
    );
    expect(await reglage("UI_PRIMARY_COLOR")).toBe("#0d9488");
    // Case décochée → retour à la palette d'origine.
    await c.post("/preferences", { action: "save_ui_color" }, { followRedirects: true });
    expect(await reglage("UI_PRIMARY_COLOR")).toBe("");
  });
});
