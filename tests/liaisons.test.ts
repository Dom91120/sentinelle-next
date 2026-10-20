/** Services utilisateurs, flux entre logiciels, dossiers du partage, tâches rattachées, référentiels (port de tests/test_liaisons.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { linkSensDepuis } from "@/lib/statuts";
import { ClientTest, clientAdmin } from "./setup/client";
import { creerUtilisateur, prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

const servicesDe = async (softwareId: number) =>
  (
    await prisma.softwareService.findMany({ where: { softwareId }, include: { userService: true } })
  ).map((x) => x.userService.name);

describe("services utilisateurs", () => {
  it("un logiciel sert plusieurs directions", async () => {
    const c = await clientAdmin();
    const a = await prisma.userService.create({ data: { name: "État civil" } });
    const b = await prisma.userService.create({ data: { name: "Urbanisme" } });
    await c.post(
      "/inventory/logiciels/create",
      { name: "Parapheur", user_service_ids: [String(a.id), String(b.id)] },
      { followRedirects: true },
    );
    const sw = await prisma.software.findFirstOrThrow({ where: { name: "Parapheur" } });
    expect(new Set(await servicesDe(sw.id))).toEqual(new Set(["État civil", "Urbanisme"]));
    expect(
      (
        await prisma.softwareService.findMany({
          where: { userServiceId: a.id },
          include: { software: true },
        })
      ).map((x) => x.software.name),
    ).toEqual(["Parapheur"]);
  });

  it("un service retiré reste sur les fiches", async () => {
    const c = await clientAdmin();
    const sv = await prisma.userService.create({ data: { name: "Jeunesse" } });
    const sw = await prisma.software.create({
      data: { name: "Portail famille", userServices: { create: { userServiceId: sv.id } } },
    });
    await c.post(`/referentiels/services/${sv.id}/delete`, {}, { followRedirects: true });
    expect((await prisma.userService.findUniqueOrThrow({ where: { id: sv.id } })).isActive).toBe(
      false,
    );
    expect(await servicesDe(sw.id)).toEqual(["Jeunesse"]);
    expect(
      (await prisma.userService.findMany({ where: { isActive: true } })).map((s) => s.id),
    ).not.toContain(sv.id);
  });

  it("un service en double est refusé", async () => {
    const c = await clientAdmin();
    await prisma.userService.create({ data: { name: "Finances" } });
    const r = await c.post(
      "/referentiels/services/add",
      { name: "Finances" },
      { followRedirects: true },
    );
    expect(r.text).toContain("existe");
    expect(await prisma.userService.count({ where: { name: "Finances" } })).toBe(1);
  });
});

describe("flux entre logiciels", () => {
  const deux = async (a = "Paie", b = "Comptabilité") =>
    [
      await prisma.software.create({ data: { name: a } }),
      await prisma.software.create({ data: { name: b } }),
    ] as const;

  it("le flux est orienté et se lit des deux côtés", async () => {
    const c = await clientAdmin();
    const [paie, compta] = await deux();
    await c.post(
      `/inventory/logiciels/${paie.id}/links/add`,
      { other_id: String(compta.id), description: "export paie mensuel" },
      { followRedirects: true },
    );
    const lien = await prisma.softwareLink.findFirstOrThrow();
    expect([lien.sourceId, lien.targetId]).toEqual([paie.id, compta.id]);
    const html = (await c.get(`/inventory/logiciels/${compta.id}`)).text;
    expect(html).toContain("depuis");
    expect(html).toContain("Paie");
  });

  it("un flux depuis l'autre logiciel l'a pour source", async () => {
    const c = await clientAdmin();
    const [paie, compta] = await deux();
    const r = await c.post(`/inventory/logiciels/${compta.id}/links/add`, {
      other_id: String(paie.id),
      sens: "depuis",
    });
    expect(r.location ?? "").toMatch(new RegExp(`/inventory/logiciels/${compta.id}$`));
    const lien = await prisma.softwareLink.findFirstOrThrow();
    expect([lien.sourceId, lien.targetId]).toEqual([paie.id, compta.id]);
    expect(lien.bidirectional).toBeFalsy();
    expect(linkSensDepuis(lien, compta.id)).toBe("entrant");
    expect(linkSensDepuis(lien, paie.id)).toBe("sortant");
  });

  it("un flux à double sens se lit double des deux côtés", async () => {
    const c = await clientAdmin();
    const [a, b] = await deux("GED", "Parapheur");
    await c.post(`/inventory/logiciels/${a.id}/links/add`, {
      other_id: String(b.id),
      sens: "double",
      description: "synchro",
    });
    const lien = await prisma.softwareLink.findFirstOrThrow();
    expect(lien.bidirectional).toBe(true);
    expect(linkSensDepuis(lien, a.id)).toBe("double");
    expect(linkSensDepuis(lien, b.id)).toBe("double");
    expect((await c.get(`/inventory/logiciels/${b.id}`)).text).toContain("double sens avec GED");
    for (const [depuis, autre, sens] of [
      [a, b, "vers"],
      [b, a, "vers"],
      [b, a, "double"],
    ] as const) {
      await c.post(`/inventory/logiciels/${depuis.id}/links/add`, {
        other_id: String(autre.id),
        sens,
      });
    }
    expect(await prisma.softwareLink.count()).toBe(1);
  });

  it("le double sens ne double pas un flux à sens unique", async () => {
    const c = await clientAdmin();
    const [a, b] = await deux("A", "B");
    await c.post(`/inventory/logiciels/${a.id}/links/add`, { other_id: String(b.id) });
    await c.post(`/inventory/logiciels/${a.id}/links/add`, {
      other_id: String(b.id),
      sens: "depuis",
    });
    expect(await prisma.softwareLink.count()).toBe(2);
    const r = await c.post(
      `/inventory/logiciels/${a.id}/links/add`,
      { other_id: String(b.id), sens: "double" },
      { followRedirects: true },
    );
    expect(r.text).toContain("sens unique");
    expect(await prisma.softwareLink.count()).toBe(2);
  });

  it("un logiciel ne s'alimente pas lui-même", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const r = await c.post(
      `/inventory/logiciels/${sw.id}/links/add`,
      { other_id: String(sw.id) },
      { followRedirects: true },
    );
    expect(r.text).toContain("lui-m");
    expect(await prisma.softwareLink.count()).toBe(0);
  });

  it("le même flux deux fois est refusé", async () => {
    const c = await clientAdmin();
    const [a, b] = await deux("A", "B");
    for (let i = 0; i < 2; i++)
      await c.post(
        `/inventory/logiciels/${a.id}/links/add`,
        { other_id: String(b.id) },
        { followRedirects: true },
      );
    expect(await prisma.softwareLink.count()).toBe(1);
  });

  it("le flux se retire depuis les deux fiches", async () => {
    const c = await clientAdmin();
    const [a, b] = await deux("A", "B");
    await c.post(
      `/inventory/logiciels/${a.id}/links/add`,
      { other_id: String(b.id) },
      { followRedirects: true },
    );
    const lien = await prisma.softwareLink.findFirstOrThrow();
    const r = await c.post(`/inventory/logiciels/links/${lien.id}/delete`, {
      from_id: String(b.id),
    });
    expect(r.location ?? "").toMatch(new RegExp(`/inventory/logiciels/${b.id}$`));
    expect(await prisma.softwareLink.count()).toBe(0);
  });

  it("supprimer un logiciel emporte ses flux", async () => {
    const [a, b] = await deux("A", "B");
    await prisma.softwareLink.create({ data: { sourceId: a.id, targetId: b.id } });
    await prisma.software.delete({ where: { id: a.id } });
    expect(await prisma.softwareLink.count()).toBe(0);
  });
});

describe("dossiers du partage réseau", () => {
  it("le chemin est affiché et copié, jamais ouvert", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GLPI" } });
    const chemin = "\\\\srv-fichiers\\Applications\\GLPI\\Installeurs";
    await c.post(
      `/inventory/logiciels/${sw.id}/shares/add`,
      { label: "Installeurs", path: chemin },
      { followRedirects: true },
    );
    const p = await prisma.softwareShare.findFirstOrThrow();
    expect(p.path).toBe(chemin);
    expect(p.label).toBe("Installeurs");
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain("Installeurs");
    expect(html).not.toContain("file://");
    expect(html).toContain("js-copier");
  });

  it("le même dossier deux fois est refusé", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GLPI" } });
    for (let i = 0; i < 2; i++)
      await c.post(
        `/inventory/logiciels/${sw.id}/shares/add`,
        { path: "\\\\srv\\part" },
        { followRedirects: true },
      );
    expect(await prisma.softwareShare.count()).toBe(1);
  });

  it("un dossier sans chemin est refusé", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GLPI" } });
    await c.post(
      `/inventory/logiciels/${sw.id}/shares/add`,
      { label: "Installeurs" },
      { followRedirects: true },
    );
    expect(await prisma.softwareShare.count()).toBe(0);
  });
});

describe("tâches récurrentes rattachées à un logiciel", () => {
  it("une tâche peut porter sur un logiciel", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GLPI" } });
    await c.post(
      "/tests/create",
      {
        name: "Mise à jour annuelle",
        test_type: "autre",
        software_id: String(sw.id),
        frequency_days: "365",
      },
      { followRedirects: true },
    );
    expect(
      (await prisma.testTask.findFirstOrThrow({ where: { name: "Mise à jour annuelle" } }))
        .softwareId,
    ).toBe(sw.id);
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).toContain("Mise à jour annuelle");
  });

  it("une tâche sans logiciel reste possible", async () => {
    const c = await clientAdmin();
    await c.post(
      "/tests/create",
      { name: "Test de restauration", test_type: "restauration", frequency_days: "90" },
      { followRedirects: true },
    );
    expect(
      (await prisma.testTask.findFirstOrThrow({ where: { name: "Test de restauration" } }))
        .softwareId,
    ).toBeNull();
  });
});

describe("référentiels administrables", () => {
  it("ajout et retrait dans une liste", async () => {
    const c = await clientAdmin();
    await c.post(
      "/referentiels/add",
      { kind: "technology", label: "Mainframe" },
      { followRedirects: true },
    );
    const item = await prisma.referential.findFirstOrThrow({
      where: { kind: "technology", label: "Mainframe" },
    });
    const r = await c.post(
      "/referentiels/add",
      { kind: "technology", label: "Mainframe" },
      { followRedirects: true },
    );
    expect(r.text).toContain("existe");
    expect(
      await prisma.referential.count({ where: { kind: "technology", label: "Mainframe" } }),
    ).toBe(1);
    await c.post(`/referentiels/${item.id}/delete`, {}, { followRedirects: true });
    expect(await prisma.referential.count({ where: { label: "Mainframe" } })).toBe(0);
  });

  it("une liste inconnue est refusée", async () => {
    const c = await clientAdmin();
    await c.post(
      "/referentiels/add",
      { kind: "lifecycle", label: "Zombie" },
      { followRedirects: true },
    );
    expect(await prisma.referential.count({ where: { label: "Zombie" } })).toBe(0);
  });

  it("les référentiels sont réservés aux admins", async () => {
    await creerUtilisateur("lecteur", "Lecteur-2026!", "viewer");
    const lecteur = new ClientTest();
    await lecteur.login("lecteur", "Lecteur-2026!");
    const r = await lecteur.get("/referentiels", { followRedirects: true });
    expect(r.text).not.toContain("Référentiels et services");
    expect(await prisma.referential.count()).toBeGreaterThan(0);
  });
});
