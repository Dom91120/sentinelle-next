/** Recherche annuaire (AD) : repli propre sans LDAP et contrôle d'accès (port de tests/test_directory.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { envDefaults } from "@/server/config-store";
import { directorySearchAvailable, searchDirectory } from "@/server/ldap";
import { ClientTest, clientAdmin } from "./setup/client";
import { resetDb } from "./setup/db";

beforeEach(resetDb);

describe("annuaire", () => {
  it("indisponible sans LDAP", async () => {
    const cfg = envDefaults();
    cfg.LDAP_ENABLED = false;
    expect(directorySearchAvailable(cfg)).toBe(false);
    expect(await searchDirectory(cfg, "dupont")).toEqual([]);
  });

  it("terme trop court : pas de requête AD", async () => {
    const cfg = envDefaults();
    cfg.LDAP_ENABLED = true;
    cfg.LDAP_SERVER = "dc.example.lan";
    cfg.LDAP_BIND_USER = "svc@example.lan";
    cfg.LDAP_BASE_DN = "DC=example,DC=lan";
    expect(await searchDirectory(cfg, "a")).toEqual([]);
  });

  it("la route répond available=false et results=[] sans AD", async () => {
    const c = await clientAdmin();
    const r = await c.get("/api/directory/search?q=dupont");
    expect(r.status).toBe(200);
    expect(r.json()).toEqual({ available: false, results: [] });
  });

  it("la route exige une connexion", async () => {
    const r = await new ClientTest().get("/api/directory/search?q=dupont");
    expect([301, 302, 303, 307, 401]).toContain(r.status);
  });
});
