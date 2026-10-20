/**
 * Liens par identifiant posés à la saisie et rapprochés au démarrage : comptes, mises à
 * jour, revues de droits (port de test_comptes_liens.py, test_maj_cible.py, test_revues_logiciel.py).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { migrateData } from "@/server/amorcage";
import { clientAdmin } from "./setup/client";
import { prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

async function fiches() {
  const sw = await prisma.software.create({ data: { name: "GLPI" } });
  const eq = await prisma.equipment.create({ data: { name: "srv-glpi", kind: "vm" } });
  const sup = await prisma.supplier.create({ data: { name: "OVHcloud" } });
  return { sw, eq, sup };
}

describe("comptes : rattachements", () => {
  it("le formulaire propose les trois rattachements", async () => {
    const c = await clientAdmin();
    await fiches();
    const html = (await c.get("/accounts/create")).text;
    for (const champ of ["software_id", "equipment_id", "supplier_id"])
      expect(html).toContain(`name="${champ}"`);
    for (const modal of ["qaModalSoftware", "qaModalEquipment", "qaModalSupplier"])
      expect(html).toContain(modal);
  });

  it("un compte créé avec ses liens, et les fiches d'en face", async () => {
    const c = await clientAdmin();
    const { sw, eq, sup } = await fiches();
    await c.post(
      "/accounts/create",
      {
        service_name: "GLPI superadmin",
        username: "glpi",
        software_id: String(sw.id),
        equipment_id: String(eq.id),
        supplier_id: String(sup.id),
      },
      { followRedirects: true },
    );
    const a = await prisma.account.findFirstOrThrow();
    expect([a.softwareId, a.equipmentId, a.supplierId]).toEqual([sw.id, eq.id, sup.id]);
    const html = (await c.get(`/accounts/${a.id}`)).text;
    expect(html).toContain(`/inventory/logiciels/${sw.id}`);
    expect(html).toContain(`/inventory/${eq.id}`);
    expect(html).toContain(`/suppliers/${sup.id}`);
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).toContain(`/accounts/${a.id}`);
    expect((await c.get(`/inventory/${eq.id}`)).text).toContain(`/accounts/${a.id}`);
    const fournisseur = (await c.get(`/suppliers/${sup.id}`)).text;
    expect(fournisseur).toContain("ong-comptes");
    expect(fournisseur).toContain(`/accounts/${a.id}`);
  });

  it("modifier retire ou change un lien", async () => {
    const c = await clientAdmin();
    const { sw, eq, sup } = await fiches();
    const a = await prisma.account.create({
      data: {
        serviceName: "GLPI superadmin",
        username: "glpi",
        softwareId: sw.id,
        supplierId: sup.id,
      },
    });
    await c.post(
      `/accounts/${a.id}/edit`,
      { service_name: "GLPI superadmin", username: "glpi", equipment_id: String(eq.id) },
      { followRedirects: true },
    );
    const maj = await prisma.account.findUniqueOrThrow({ where: { id: a.id } });
    expect([maj.softwareId, maj.equipmentId, maj.supplierId]).toEqual([null, eq.id, null]);
  });

  it("un identifiant qui ne désigne rien ne se pose pas", async () => {
    const c = await clientAdmin();
    const { sw } = await fiches();
    await prisma.software.update({ where: { id: sw.id }, data: { isActive: false } });
    await c.post(
      "/accounts/create",
      { service_name: "X", username: "x", software_id: String(sw.id), equipment_id: "999" },
      { followRedirects: true },
    );
    const a = await prisma.account.findFirstOrThrow();
    expect(a.softwareId).toBeNull();
    expect(a.equipmentId).toBeNull();
  });

  it("la migration relie par nom du service", async () => {
    const { sw, eq, sup } = await fiches();
    await prisma.account.createMany({
      data: [
        { serviceName: "glpi", username: "a" },
        { serviceName: "SRV-GLPI", username: "b" },
        { serviceName: "OVH Manager", username: "c" },
        { serviceName: "GLPI", username: "d", supplierId: sup.id },
      ],
    });
    await migrateData();
    const [a, b, cc, dd] = await prisma.account.findMany({ orderBy: { id: "asc" } });
    expect(a.softwareId).toBe(sw.id);
    expect(a.equipmentId).toBeNull();
    expect(b.equipmentId).toBe(eq.id);
    expect(b.softwareId).toBeNull();
    expect(cc.softwareId).toBeNull();
    expect(cc.equipmentId).toBeNull();
    expect(dd.softwareId).toBeNull();
    expect(dd.supplierId).toBe(sup.id);
  });

  it("la migration ne tranche pas entre deux homonymes", async () => {
    await prisma.software.createMany({ data: [{ name: "GLPI" }, { name: "glpi" }] });
    await prisma.account.create({ data: { serviceName: "GLPI", username: "a" } });
    await migrateData();
    expect((await prisma.account.findFirstOrThrow()).softwareId).toBeNull();
  });
});

describe("mises à jour : la cible", () => {
  it("le nom d'un logiciel relie la mise à jour", async () => {
    const c = await clientAdmin();
    const { sw } = await fiches();
    await c.post(
      "/updates/create",
      { name: "glpi", status: "up_to_date" },
      { followRedirects: true },
    );
    const u = await prisma.systemUpdate.findFirstOrThrow();
    expect(u.softwareId).toBe(sw.id);
    expect(u.equipmentId).toBeNull();
    expect((await c.get(`/updates/${u.id}`)).text).toContain(`/inventory/logiciels/${sw.id}`);
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).toContain(`/updates/${u.id}`);
  });

  it("le nom d'un équipement relie sans choix explicite", async () => {
    const c = await clientAdmin();
    const { eq } = await fiches();
    await c.post(
      "/updates/create",
      { name: "SRV-GLPI", status: "up_to_date" },
      { followRedirects: true },
    );
    const u = await prisma.systemUpdate.findFirstOrThrow();
    expect(u.equipmentId).toBe(eq.id);
    expect(u.softwareId).toBeNull();
  });

  it("l'équipement choisi prime sur le nom", async () => {
    const c = await clientAdmin();
    const { sw } = await fiches();
    const autre = await prisma.equipment.create({ data: { name: "srv-autre", kind: "vm" } });
    await c.post(
      "/updates/create",
      { name: "GLPI", status: "up_to_date", equipment_id: String(autre.id) },
      { followRedirects: true },
    );
    const u = await prisma.systemUpdate.findFirstOrThrow();
    expect(u.softwareId).toBe(sw.id);
    expect(u.equipmentId).toBe(autre.id);
  });

  it("modifier le nom repose le lien", async () => {
    const c = await clientAdmin();
    const { sw } = await fiches();
    const u = await prisma.systemUpdate.create({ data: { name: "GLPI", softwareId: sw.id } });
    await c.post(
      `/updates/${u.id}/edit`,
      { name: "Hors inventaire", status: "up_to_date" },
      { followRedirects: true },
    );
    const maj = await prisma.systemUpdate.findUniqueOrThrow({ where: { id: u.id } });
    expect(maj.softwareId).toBeNull();
    expect(maj.equipmentId).toBeNull();
    expect(maj.name).toBe("Hors inventaire");
  });

  it("la migration relie par nom sans homonyme", async () => {
    const { sw, eq } = await fiches();
    await prisma.software.createMany({ data: [{ name: "Paie" }, { name: "paie" }] });
    await prisma.systemUpdate.createMany({
      data: [{ name: "glpi" }, { name: "srv-glpi" }, { name: "Paie" }, { name: "Windows Server" }],
    });
    await migrateData();
    const [a, b, cc, dd] = await prisma.systemUpdate.findMany({ orderBy: { id: "asc" } });
    expect(a.softwareId).toBe(sw.id);
    expect(b.equipmentId).toBe(eq.id);
    expect(cc.softwareId).toBeNull();
    expect(dd.softwareId).toBeNull();
    expect(dd.equipmentId).toBeNull();
  });
});

describe("revues de droits : le logiciel", () => {
  const logiciel = (name: string) => prisma.software.create({ data: { name } });

  it("une revue créée depuis le formulaire est reliée", async () => {
    const c = await clientAdmin();
    const sw = await logiciel("GED Maarch");
    await c.post(
      "/reviews/create",
      { application: "ged maarch", frequency_days: "365" },
      { followRedirects: true },
    );
    const r = await prisma.accessReview.findFirstOrThrow();
    expect(r.softwareId).toBe(sw.id);
    expect(r.application).toBe("GED Maarch");
    expect((await c.get(`/reviews/${r.id}`)).text).toContain(`/inventory/logiciels/${sw.id}`);
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain("Revues de droits");
    expect(html).toContain(`/reviews/${r.id}`);
  });

  it("une application hors inventaire reste sans lien", async () => {
    const c = await clientAdmin();
    await c.post(
      "/reviews/create",
      { application: "AppLegacy", frequency_days: "365" },
      { followRedirects: true },
    );
    const r = await prisma.accessReview.findFirstOrThrow();
    expect(r.softwareId).toBeNull();
    expect(r.application).toBe("AppLegacy");
    expect((await c.get(`/reviews/${r.id}`)).text).toContain("hors inventaire");
  });

  it("modifier la revue repose ou retire le lien", async () => {
    const c = await clientAdmin();
    const sw = await logiciel("Paie");
    const r = await prisma.accessReview.create({ data: { application: "AppLegacy" } });
    await c.post(
      `/reviews/${r.id}/edit`,
      { application: "Paie", frequency_days: "365" },
      { followRedirects: true },
    );
    expect((await prisma.accessReview.findUniqueOrThrow({ where: { id: r.id } })).softwareId).toBe(
      sw.id,
    );
    await c.post(
      `/reviews/${r.id}/edit`,
      { application: "Autre", frequency_days: "365" },
      { followRedirects: true },
    );
    const maj = await prisma.accessReview.findUniqueOrThrow({ where: { id: r.id } });
    expect(maj.softwareId).toBeNull();
    expect(maj.application).toBe("Autre");
  });

  it("renommer le logiciel renomme ses revues", async () => {
    const c = await clientAdmin();
    const sw = await logiciel("GED Maarch");
    const r = await prisma.accessReview.create({
      data: { application: "GED Maarch", softwareId: sw.id },
    });
    await c.post(
      `/inventory/logiciels/${sw.id}/edit`,
      { name: "Maarch Courrier", hosting: "on_premise" },
      { followRedirects: true },
    );
    expect((await prisma.accessReview.findUniqueOrThrow({ where: { id: r.id } })).application).toBe(
      "Maarch Courrier",
    );
  });

  it("la migration relie les revues par nom", async () => {
    const sw = await logiciel("SIRH");
    await prisma.accessReview.createMany({
      data: [{ application: "sirh" }, { application: "Inconnue" }],
    });
    await migrateData();
    const [liee, orpheline] = await prisma.accessReview.findMany({ orderBy: { id: "asc" } });
    expect(liee.softwareId).toBe(sw.id);
    expect(orpheline.softwareId).toBeNull();
  });

  it("la migration ne tranche pas entre deux homonymes", async () => {
    await logiciel("GLPI");
    await logiciel("GLPI");
    await prisma.accessReview.create({ data: { application: "GLPI" } });
    await migrateData();
    expect((await prisma.accessReview.findFirstOrThrow()).softwareId).toBeNull();
  });

  it("la migration ignore un logiciel à la corbeille", async () => {
    const sw = await logiciel("Vieux");
    await prisma.software.update({ where: { id: sw.id }, data: { isActive: false } });
    await prisma.accessReview.create({ data: { application: "Vieux" } });
    await migrateData();
    expect((await prisma.accessReview.findFirstOrThrow()).softwareId).toBeNull();
  });

  it("la migration ne touche pas un lien déjà posé", async () => {
    const a = await logiciel("Finances BL");
    const b = await logiciel("Finances Berger-Levrault");
    const r = await prisma.accessReview.create({
      data: { application: "Finances Berger-Levrault", softwareId: a.id },
    });
    await migrateData();
    expect((await prisma.accessReview.findUniqueOrThrow({ where: { id: r.id } })).softwareId).toBe(
      a.id,
    );
    expect(b.id).not.toBe(a.id);
  });
});
