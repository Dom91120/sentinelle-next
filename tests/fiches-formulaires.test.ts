/** Toutes les fiches se lisent de la même façon ; tous les formulaires s'ouvrent (port de test_fiches.py et test_formulaires.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { ClientTest, clientAdmin } from "./setup/client";
import { admin, prisma, resetDb } from "./setup/db";
import { entre } from "./setup/html";

beforeEach(resetDb);

const d = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));

/** Une fiche de chaque sorte, remplie : c'est remplie qu'une fiche déplie ses blocs conditionnels. */
async function jeu(): Promise<Record<string, number>> {
  const sup = await prisma.supplier.create({
    data: {
      name: "Éditeur",
      supportPhone: "01 02 03 04 05",
      customerRef: "CLI-42",
      hours: "9h-18h",
    },
  });
  const eq = await prisma.equipment.create({
    data: { name: "SRV-APP01", kind: "vm", ipAddress: "10.0.0.1" },
  });
  const ids: Record<string, number> = {};
  ids["/accounts"] = (
    await prisma.account.create({
      data: {
        serviceName: "Firewall",
        username: "admin",
        url: "https://fw.local",
        priority: "high",
        rotationDays: 90,
        description: "Compte de secours",
        lastPasswordChange: d(2026, 1, 1),
        nextPasswordChange: d(2030, 1, 1),
      },
    })
  ).id;
  ids["/backups"] = (
    await prisma.backup.create({
      data: { serviceName: "Veeam", backupType: "full", location: "NAS", frequency: "daily" },
    })
  ).id;
  ids["/domains"] = (
    await prisma.domain.create({
      data: { name: "exemple.fr", registrar: "OVH", expiryDate: d(2030, 1, 1) },
    })
  ).id;
  ids["/reviews"] = (
    await prisma.accessReview.create({
      data: {
        application: "SIRH",
        responsible: "Rita",
        responsibleEmail: "rita@ville.fr",
        frequencyDays: 180,
      },
    })
  ).id;
  ids["/tests"] = (
    await prisma.testTask.create({
      data: {
        name: "Test de restauration",
        testType: "restauration",
        frequencyDays: 90,
        priority: "high",
      },
    })
  ).id;
  ids["/updates"] = (
    await prisma.systemUpdate.create({
      data: {
        name: "Serveur web",
        currentVersion: "1.0",
        latestVersion: "1.2",
        equipmentId: eq.id,
      },
    })
  ).id;
  ids["/inventory"] = eq.id;
  ids["/contracts"] = (
    await prisma.contract.create({
      data: { name: "Marché 2026", supplierId: sup.id, costYearly: 1200, endDate: d(2030, 1, 1) },
    })
  ).id;
  ids["/suppliers"] = sup.id;
  ids["/certificates"] = (
    await prisma.certificate.create({
      data: {
        kind: "tls",
        serviceName: "Portail",
        domain: "portail.fr",
        issuer: "Sectigo",
        expiryDate: d(2030, 1, 1),
      },
    })
  ).id;
  ids["/inventory/logiciels"] = (
    await prisma.software.create({
      data: { name: "SIRH", supplierId: sup.id, hosting: "saas", version: "3.1" },
    })
  ).id;
  return ids;
}
const fiches = (ids: Record<string, number>) =>
  Object.entries(ids).map(([base, id]) => `${base}/${id}`);

describe("fiches", () => {
  it("chaque fiche s'ouvre", async () => {
    const c = await clientAdmin();
    for (const url of fiches(await jeu())) expect((await c.get(url)).status, url).toBe(200);
  });

  it("un menu d'une seule entrée devient un bouton", async () => {
    const c = await clientAdmin();
    const ids = await jeu();
    const test = (await c.get(`/tests/${ids["/tests"]}`)).text;
    expect(test).toContain('<ul class="menu-seul">');
    expect(test).not.toContain("dropdown-menu");
    expect(test).toContain('title="Exporter en PDF"');
    const domaine = (await c.get(`/domains/${ids["/domains"]}`)).text;
    expect(domaine).toContain("dropdown-menu");
    expect(domaine).not.toContain("menu-seul");
  });

  it("supprimer est au pied du formulaire", async () => {
    const c = await clientAdmin();
    for (const url of fiches(await jeu())) {
      const html = (await c.get(url)).text;
      expect(html, url).toContain(`data-confirm-action="${url}/delete"`);
      expect(html, url).toContain('id="form-supprimer"');
      expect(html, url).not.toContain("dropdown-item text-danger");
    }
  });

  it("aucune fiche ne délaye ses champs", async () => {
    const c = await clientAdmin();
    for (const url of fiches(await jeu())) {
      const html = (await c.get(url)).text;
      expect(html.includes("fiche-grille") || html.includes("lu-rangee"), url).toBe(true);
      expect(html, url).not.toContain("table-borderless");
    }
  });

  it("chaque fiche montre ses sections", async () => {
    const c = await clientAdmin();
    for (const url of fiches(await jeu())) {
      const html = (await c.get(url)).text;
      let blocs = html.match(/class="fiche-bloc/g)?.length ?? 0;
      if (html.includes("mb-3 synthese")) {
        const synthese = entre(html, 'id="vol-detail"', 'class="tab-pane');
        blocs =
          synthese.split("mb-3 synthese", 2)[1]?.match(/fiche-titre fiche-titre--/g)?.length ?? 0;
      }
      expect(blocs, url).toBeGreaterThanOrEqual(2);
    }
  });

  it("les balises se ferment", async () => {
    const c = await clientAdmin();
    for (const url of fiches(await jeu())) {
      const html = (await c.get(url)).text;
      expect(html.split("<div").length, url).toBe(html.split("</div>").length);
    }
  });

  it("chaque fiche répond avant d'être lue", async () => {
    const c = await clientAdmin();
    for (const url of fiches(await jeu())) {
      const html = (await c.get(url)).text;
      expect(html, url).toContain("fiche-entete");
      expect(html, url).not.toContain("Retour</a>");
      if (html.includes("fiche-bandeau-ligne")) expect(html, url).toContain("fiche-bandeau-k");
      else if (url.includes("/inventory/logiciels/") || url.includes("/suppliers/"))
        expect(html, url).not.toContain("fiche-faits");
      else {
        expect(html, url).toContain("fiche-faits");
        const cases = html.match(/class="fiche-fait"/g)?.length ?? 0;
        expect(cases, url).toBeGreaterThanOrEqual(3);
        expect(cases, url).toBeLessThanOrEqual(6);
      }
    }
  });

  it("les pièces jointes sont à un clic", async () => {
    const c = await clientAdmin();
    const ids = await jeu();
    const html = (await c.get(`/inventory/logiciels/${ids["/inventory/logiciels"]}`)).text;
    expect(html).toContain("fiche-onglets");
    expect(html).toContain('data-bs-target="#vol-documents"');
    expect(html).toContain('data-bs-target="#vol-detail"');
    expect(html).toContain('id="vol-documents"');
  });

  it("chaque fiche a ses onglets", async () => {
    const c = await clientAdmin();
    for (const url of fiches(await jeu())) {
      const html = (await c.get(url)).text;
      expect(html, url).toContain("fiche-onglets");
      expect(html, url).toContain('id="vol-detail"');
    }
  });

  it("chaque fiche se modifie sur place", async () => {
    const c = await clientAdmin();
    for (const url of fiches(await jeu())) {
      const html = (await c.get(url)).text;
      expect(html, url).toContain('data-bs-target="#vol-details"');
      expect(html.split('id="form-principal"').length - 1, url).toBe(1);
      const volet = html.split('id="vol-details"', 2)[1];
      expect(volet, url).toContain("data-edition-verrou");
      const formulaire = volet.split('id="form-principal"', 2)[1].split(">", 2)[0];
      expect(formulaire, url).toContain("data-edition-visible");
      expect(formulaire, url).toContain("/edit");
    }
  });
});

const CREATIONS = [
  "/accounts/create",
  "/backups/create",
  "/domains/create",
  "/reviews/create",
  "/tests/create",
  "/updates/create",
  "/users/create",
  "/contracts/create",
  "/suppliers/create",
  "/inventory/create",
  "/inventory/create?famille=reseau",
  "/certificates/create?kind=tls",
  "/certificates/create?kind=signature",
  "/inventory/logiciels/create",
];

describe("formulaires", () => {
  async function jeuMinimal() {
    const ids: Record<string, number> = {};
    ids.accounts = (
      await prisma.account.create({
        data: { serviceName: "A", username: "u", nextPasswordChange: d(2030, 1, 1) },
      })
    ).id;
    ids.backups = (await prisma.backup.create({ data: { serviceName: "B" } })).id;
    ids.domains = (
      await prisma.domain.create({ data: { name: "d.fr", expiryDate: d(2030, 1, 1) } })
    ).id;
    ids.reviews = (await prisma.accessReview.create({ data: { application: "R" } })).id;
    ids.tests = (await prisma.testTask.create({ data: { name: "T", testType: "autre" } })).id;
    ids.updates = (await prisma.systemUpdate.create({ data: { name: "U" } })).id;
    ids.inventory = (await prisma.equipment.create({ data: { name: "E", kind: "network" } })).id;
    ids.contracts = (await prisma.contract.create({ data: { name: "C" } })).id;
    ids.suppliers = (await prisma.supplier.create({ data: { name: "S" } })).id;
    ids.certificates = (
      await prisma.certificate.create({
        data: { kind: "signature", serviceName: "Cert", holder: "H" },
      })
    ).id;
    ids.software = (await prisma.software.create({ data: { name: "L" } })).id;
    return ids;
  }

  it("chaque formulaire de création s'ouvre", async () => {
    const c = await clientAdmin();
    await jeuMinimal();
    for (const url of CREATIONS) expect((await c.get(url)).status, url).toBe(200);
  });

  it("chaque formulaire porte ses sections", async () => {
    const c = await clientAdmin();
    await jeuMinimal();
    for (const url of CREATIONS) {
      const html = (await c.get(url)).text;
      let sections = [...html.matchAll(/class="form-section form-section--(\w+)/g)].map(
        (m) => m[1],
      );
      if (url !== "/users/create") {
        expect(sections, url).toEqual([]);
        sections = [...html.matchAll(/fiche-titre fiche-titre--(\w+)/g)].map((m) => m[1]);
      }
      expect(sections.length, url).toBeGreaterThanOrEqual(2);
      const accents = sections.filter((s) => s !== "slate");
      expect(accents.length, `${url} : couleur répétée ${accents}`).toBe(new Set(accents).size);
    }
  });

  it("chaque formulaire de modification s'ouvre", async () => {
    const c = await clientAdmin();
    const ids = await jeuMinimal();
    const bases: Record<string, string> = {
      accounts: "/accounts",
      backups: "/backups",
      domains: "/domains",
      reviews: "/reviews",
      tests: "/tests",
      updates: "/updates",
      inventory: "/inventory",
      contracts: "/contracts",
      suppliers: "/suppliers",
      certificates: "/certificates",
      software: "/inventory/logiciels",
    };
    for (const [cle, base] of Object.entries(bases))
      expect((await c.get(`${base}/${ids[cle]}/edit`)).status, base).toBe(200);
    expect((await c.get(`/users/${(await admin()).id}/edit`)).status).toBe(200);
  });

  it("les sections ferment ce qu'elles ouvrent", async () => {
    const c = await clientAdmin();
    await jeuMinimal();
    for (const url of CREATIONS) {
      const html = (await c.get(url)).text;
      expect(html.split('<fieldset class="form-section').length, url).toBe(
        html.split("</fieldset>").length,
      );
    }
  });

  it("l'écran des mises à jour liste les logiciels", async () => {
    const c = await clientAdmin();
    await jeuMinimal();
    const html = (await c.get("/updates/create")).text;
    expect(html).toContain(">L<");
    const { activeAssets } = await import("@/modules/updates/server");
    const noms = (await activeAssets()).map((a: { name: string }) => a.name);
    expect(noms).toContain("L");
    expect(noms).toContain("E");
  });

  it("un utilisateur se connecte pour voir une fiche", async () => {
    expect((await new ClientTest().get("/accounts")).status).toBeGreaterThanOrEqual(300);
  });
});
