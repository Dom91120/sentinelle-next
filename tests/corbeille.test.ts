/** Corbeille : les équipements désactivés se restaurent et se purgent comme les autres (port de tests/test_corbeille.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { SPECS } from "@/server/corbeille";
import { clientAdmin } from "./setup/client";
import { jour, prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

const equipementSupprime = (name = "SRV-CORB-01") =>
  prisma.equipment.create({ data: { name, kind: "vm", isActive: false } });

describe("corbeille", () => {
  it("un équipement supprimé est visible dans la corbeille", async () => {
    const c = await clientAdmin();
    const e = await equipementSupprime();
    const r = await c.get("/trash");
    expect(r.status).toBe(200);
    expect(r.text).toContain("Matériel");
    expect(r.text).toContain(e.name);
  });

  it("restauration d'un équipement", async () => {
    const c = await clientAdmin();
    const e = await equipementSupprime();
    const r = await c.post(
      "/trash/restore",
      { entity_type: "equipment", entity_id: String(e.id) },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    expect(r.text).toContain("Élément restauré.");
    expect((await prisma.equipment.findUnique({ where: { id: e.id } }))?.isActive).toBe(true);
  });

  it("la purge détache les éléments liés", async () => {
    const c = await clientAdmin();
    const e = await equipementSupprime();
    const cert = await prisma.certificate.create({
      data: {
        serviceName: "Intranet",
        domain: "intra.exemple.fr",
        expiryDate: jour(90),
        equipmentId: e.id,
      },
    });
    const bkp = await prisma.backup.create({
      data: { serviceName: "Veeam SRV-CORB-01", frequency: "daily", equipmentId: e.id },
    });
    const upd = await prisma.systemUpdate.create({ data: { name: "GLPI", equipmentId: e.id } });
    const r = await c.post(
      "/trash/purge-one",
      { entity_type: "equipment", entity_id: String(e.id) },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    expect(await prisma.equipment.findUnique({ where: { id: e.id } })).toBeNull();
    expect(
      (await prisma.certificate.findUnique({ where: { id: cert.id } }))?.equipmentId,
    ).toBeNull();
    expect((await prisma.backup.findUnique({ where: { id: bkp.id } }))?.equipmentId).toBeNull();
    expect(
      (await prisma.systemUpdate.findUnique({ where: { id: upd.id } }))?.equipmentId,
    ).toBeNull();
  });

  it("vider la corbeille inclut les équipements", async () => {
    const c = await clientAdmin();
    const e = await equipementSupprime();
    const r = await c.post("/trash/purge", {}, { followRedirects: true });
    expect(r.status).toBe(200);
    expect(await prisma.equipment.findUnique({ where: { id: e.id } })).toBeNull();
  });

  it("le badge de la corbeille couvre les mêmes catégories que la page", () => {
    const cats = new Set(Object.values(SPECS).map((s) => s.cat));
    for (const cat of [
      "accounts",
      "certificates",
      "domains",
      "backups",
      "tests",
      "reviews",
      "updates",
      "inventory",
    ])
      expect(cats, cat).toContain(cat);
  });
});
