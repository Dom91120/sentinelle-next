/** Inventaire Logiciels métiers : serveurs (M:N), statut agrégé, fiche enrichie, onglets, flux, préférences (port de tests/test_software.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { softwareComputedStatus, softwareIsSaas, softwareOverLicence } from "@/lib/statuts";
import { clientAdmin } from "./setup/client";
import { jour, prisma, reglage, resetDb } from "./setup/db";
import { entre } from "./setup/html";

beforeEach(resetDb);

const serveursDe = async (softwareId: number) =>
  (
    await prisma.softwareEquipment.findMany({ where: { softwareId }, include: { equipment: true } })
  ).map((x) => x.equipment.name);
const contratsDe = async (softwareId: number) =>
  (
    await prisma.contractSoftware.findMany({ where: { softwareId }, include: { contract: true } })
  ).map((x) => x.contract.name);
const servicesDe = async (softwareId: number) =>
  (
    await prisma.softwareService.findMany({ where: { softwareId }, include: { userService: true } })
  ).map((x) => x.userService.name);
const certificatsDe = async (softwareId: number) =>
  (
    await prisma.softwareCertificate.findMany({
      where: { softwareId },
      include: { certificate: true },
    })
  ).map((x) => x.certificate.serviceName);
const lire = (id: number) => prisma.software.findUniqueOrThrow({ where: { id } });

describe("logiciels", () => {
  it("création avec plusieurs serveurs", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({ data: { name: "Éditeur" } });
    const e1 = await prisma.equipment.create({ data: { name: "A", kind: "vm" } });
    const e2 = await prisma.equipment.create({ data: { name: "B", kind: "vm" } });
    const ct = await prisma.contract.create({ data: { name: "Licence" } });
    const r = await c.post(
      "/inventory/logiciels/create",
      {
        name: "Genesis",
        supplier_id: String(sup.id),
        contract_ids: [String(ct.id)],
        hosting: "saas",
        equipment_ids: [String(e1.id), String(e2.id)],
      },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    const sw = await prisma.software.findFirstOrThrow({ where: { name: "Genesis" } });
    expect(softwareIsSaas(sw)).toBe(true);
    expect(sw.supplierId).toBe(sup.id);
    expect(await contratsDe(sw.id)).toEqual(["Licence"]);
    expect(new Set(await serveursDe(sw.id))).toEqual(new Set(["A", "B"]));
  });

  it("création d'un logiciel Docker", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/inventory/logiciels/create")).text;
    for (const v of [
      'value="on_premise"',
      'value="saas"',
      'value="hybride"',
      'name="is_docker"',
      "icon-docker",
    ])
      expect(html).toContain(v);
    await c.post(
      "/inventory/logiciels/create",
      { name: "Portainer", hosting: "on_premise", is_docker: "on" },
      { followRedirects: true },
    );
    let sw = await prisma.software.findFirstOrThrow({ where: { name: "Portainer" } });
    expect(sw.isDocker).toBe(true);
    expect(softwareIsSaas(sw)).toBe(false);
    await c.post(
      `/inventory/logiciels/${sw.id}/edit`,
      { name: "Portainer", hosting: "saas", is_docker: "on" },
      { followRedirects: true },
    );
    sw = await lire(sw.id);
    expect(softwareIsSaas(sw) && sw.isDocker).toBe(true);
    await c.post(
      `/inventory/logiciels/${sw.id}/edit`,
      { name: "Portainer", hosting: "on_premise" },
      { followRedirects: true },
    );
    sw = await lire(sw.id);
    expect(sw.isDocker).toBe(false);
    expect(softwareIsSaas(sw)).toBe(false);
  });

  it("hybride échappe au parc", async () => {
    const c = await clientAdmin();
    await c.post(
      "/inventory/logiciels/create",
      { name: "Portail Citoyen", hosting: "hybride" },
      { followRedirects: true },
    );
    const sw = await prisma.software.findFirstOrThrow({ where: { name: "Portail Citoyen" } });
    expect(sw.hosting).toBe("hybride");
    expect(softwareIsSaas(sw)).toBe(true);
  });

  it("la liste filtre par hébergement", async () => {
    const c = await clientAdmin();
    await prisma.software.createMany({
      data: [
        { name: "ConteneurGED", isDocker: true },
        { name: "CloudRH", hosting: "saas" },
        { name: "CloudDockerPaie", hosting: "saas", isDocker: true },
        { name: "PortailMixte", hosting: "hybride" },
        { name: "LocalFinances" },
      ],
    });
    let html = (await c.get("/inventory/logiciels?host=docker")).text;
    expect(html).toContain("ConteneurGED");
    expect(html).toContain("CloudDockerPaie");
    expect(html).not.toContain("CloudRH");
    expect(html).not.toContain("LocalFinances");
    html = (await c.get("/inventory/logiciels?host=saas")).text;
    for (const n of ["CloudRH", "CloudDockerPaie", "PortailMixte"]) expect(html).toContain(n);
    expect(html).not.toContain("ConteneurGED");
    html = (await c.get("/inventory/logiciels?host=onprem")).text;
    for (const n of ["LocalFinances", "ConteneurGED", "PortailMixte"]) expect(html).toContain(n);
    expect(html).not.toContain("CloudRH");
    expect(html).not.toContain("CloudDockerPaie");
    html = (await c.get("/inventory/logiciels")).text;
    for (const n of ["ConteneurGED", "CloudRH", "CloudDockerPaie", "PortailMixte", "LocalFinances"])
      expect(html).toContain(n);
  });

  it("la modification remplace les serveurs", async () => {
    const c = await clientAdmin();
    const e1 = await prisma.equipment.create({ data: { name: "A", kind: "vm" } });
    const e2 = await prisma.equipment.create({ data: { name: "B", kind: "vm" } });
    await c.post(
      "/inventory/logiciels/create",
      { name: "GX", equipment_ids: [String(e1.id)] },
      { followRedirects: true },
    );
    const sw = await prisma.software.findFirstOrThrow({ where: { name: "GX" } });
    await c.post(
      `/inventory/logiciels/${sw.id}/edit`,
      { name: "GX", equipment_ids: [String(e2.id)] },
      { followRedirects: true },
    );
    expect(await serveursDe(sw.id)).toEqual(["B"]);
  });

  it("statut calculé depuis les mises à jour", async () => {
    const sw = await prisma.software.create({ data: { name: "S" } });
    const statut = async () =>
      softwareComputedStatus(
        await lire(sw.id),
        await prisma.systemUpdate.findMany({ where: { softwareId: sw.id, isActive: true } }),
      );
    expect(await statut()).toBe("success");
    await prisma.systemUpdate.create({
      data: { name: "u", status: "update_available", softwareId: sw.id },
    });
    expect(await statut()).toBe("warning");
    await prisma.systemUpdate.create({
      data: { name: "u2", status: "critical", softwareId: sw.id },
    });
    expect(await statut()).toBe("danger");
  });

  it("suppression d'un logiciel", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Z" } });
    await c.post(`/inventory/logiciels/${sw.id}/delete`, {}, { followRedirects: true });
    expect((await lire(sw.id)).isActive).toBe(false);
  });

  it("ajout rapide d'une application", async () => {
    const c = await clientAdmin();
    const r = await c.post("/inventory/logiciels/quick-create", { name: "SIRH" });
    expect(r.status).toBe(200);
    const j = r.json<{ ok: boolean; name: string; id: number }>();
    expect(j.ok && j.name === "SIRH" && Number.isInteger(j.id)).toBe(true);
    expect(await prisma.software.findFirst({ where: { name: "SIRH" } })).not.toBeNull();
    expect((await c.post("/inventory/logiciels/quick-create", { name: "" })).status).toBe(400);
  });

  it("la revue pointe sur l'inventaire des applications", async () => {
    const c = await clientAdmin();
    await prisma.software.createMany({ data: [{ name: "GED" }, { name: "Finances" }] });
    const html = (await c.get("/reviews/create")).text;
    expect(html).toMatch(/<select[^>]*name="application"/);
    expect(html).toContain(">GED<");
    expect(html).toContain(">Finances<");
    expect(html).not.toContain("qaModalSoftware");
  });

  it("la revue conserve une application hors inventaire", async () => {
    const c = await clientAdmin();
    const rv = await prisma.accessReview.create({
      data: { application: "AppLegacy", frequencyDays: 365, status: "pending" },
    });
    const html = (await c.get(`/reviews/${rv.id}/edit`)).text;
    expect(html).toContain("AppLegacy");
    expect(html).toContain("hors inventaire");
  });

  it("le catalogue se crée ici", async () => {
    const c = await clientAdmin();
    const r = await c.get("/inventory/logiciels/create", { followRedirects: true });
    expect(r.text).toContain("Ajouter un logiciel");
    expect(r.text).not.toContain("SoftInventory");
    await c.post("/inventory/logiciels/create", { name: "Saisi ici" }, { followRedirects: true });
    expect(await prisma.software.findFirst({ where: { name: "Saisi ici" } })).not.toBeNull();
    expect((await c.post("/inventory/logiciels/quick-create", { name: "Express" })).status).toBe(
      200,
    );
    expect(await prisma.software.findFirst({ where: { name: "Express" } })).not.toBeNull();
  });

  it("une fiche locale reste entièrement modifiable", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Local", responsible: "MARTIN" } });
    await c.post(
      `/inventory/logiciels/${sw.id}/edit`,
      { name: "Local renommé", responsible: "DUPONT", hosting: "saas" },
      { followRedirects: true },
    );
    const maj = await lire(sw.id);
    expect(maj.name).toBe("Local renommé");
    expect(maj.responsible).toBe("DUPONT");
  });

  it("la création enregistre la qualification et le RGPD", async () => {
    const c = await clientAdmin();
    const techno = await prisma.referential.findFirstOrThrow({
      where: { kind: "technology", label: "Web" },
    });
    await c.post(
      "/inventory/logiciels/create",
      {
        name: "Concerto",
        hosting: "hybride",
        lifecycle: "fin_de_vie",
        source_type: "opensource",
        technology_id: String(techno.id),
        auth_mode: "mixte_ldap",
        auth_strong: "on",
        users_count: "120",
        users_max: "100",
        service_date: "2019-03-01",
        internal_dev: "on",
        no_server: "on",
        tech_responsible: "DURAND",
        tech_responsible_email: "durand@ville.fr",
        no_contract_note: "Marché porté par le CCAS",
        gdpr_personal_data: "on",
        gdpr_categories: "état civil, NIR",
        gdpr_registry_ref: "T-014",
        gdpr_location: "ue",
      },
      { followRedirects: true },
    );
    const sw = await prisma.software.findFirstOrThrow({ where: { name: "Concerto" } });
    expect(sw.lifecycle).toBe("fin_de_vie");
    expect(sw.sourceType).toBe("opensource");
    expect(sw.technologyId).toBe(techno.id);
    expect(sw.authMode).toBe("mixte_ldap");
    expect(sw.authStrong && sw.internalDev && sw.noServer).toBe(true);
    expect([sw.usersCount, sw.usersMax]).toEqual([120, 100]);
    expect(sw.serviceDate?.toISOString().slice(0, 10)).toBe("2019-03-01");
    expect(sw.techResponsibleEmail).toBe("durand@ville.fr");
    expect(sw.noContractNote).toBe("Marché porté par le CCAS");
    expect(sw.gdprPersonalData).toBe(true);
    expect(sw.gdprRegistryRef).toBe("T-014");
    expect(sw.gdprLocation).toBe("ue");
  });

  it("une valeur de liste inconnue retombe sur le défaut", async () => {
    const c = await clientAdmin();
    await c.post(
      "/inventory/logiciels/create",
      {
        name: "Bidon",
        hosting: "ailleurs",
        lifecycle: "zombie",
        source_type: "magique",
        auth_mode: "telepathie",
        gdpr_location: "lune",
      },
      { followRedirects: true },
    );
    const sw = await prisma.software.findFirstOrThrow({ where: { name: "Bidon" } });
    expect(sw.hosting).toBe("on_premise");
    expect(sw.lifecycle).toBe("production");
    expect(sw.sourceType).toBe("proprietaire");
    expect(sw.authMode).toBeNull();
    expect(sw.gdprLocation).toBe("inconnue");
  });

  it("la fin de vie passe le statut à orange", async () => {
    const fin = await prisma.software.create({ data: { name: "Vieux", lifecycle: "fin_de_vie" } });
    const abandonne = await prisma.software.create({
      data: { name: "Retiré", lifecycle: "abandonne" },
    });
    const vivant = await prisma.software.create({
      data: { name: "Actuel", lifecycle: "production" },
    });
    expect(softwareComputedStatus(fin, [])).toBe("warning");
    expect(softwareComputedStatus(abandonne, [])).toBe("success");
    expect(softwareComputedStatus(vivant, [])).toBe("success");
  });

  it("une MAJ critique prime sur le cycle de vie", async () => {
    const sw = await prisma.software.create({ data: { name: "Portail", lifecycle: "fin_de_vie" } });
    await prisma.systemUpdate.create({
      data: { name: "Portail", softwareId: sw.id, status: "critical" },
    });
    expect(
      softwareComputedStatus(
        sw,
        await prisma.systemUpdate.findMany({ where: { softwareId: sw.id } }),
      ),
    ).toBe("danger");
  });

  it("dépassement de licence", () => {
    expect(softwareOverLicence({ usersCount: 120, usersMax: 100 })).toBe(true);
    expect(softwareOverLicence({ usersCount: 80, usersMax: 100 })).toBe(false);
    expect(softwareOverLicence({ usersCount: 80, usersMax: null })).toBeNull();
    expect(softwareOverLicence({ usersCount: null, usersMax: 100 })).toBeNull();
  });

  it("la fiche affiche tout ce qu'elle porte", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({
      data: {
        name: "Éditeur",
        customerRef: "CLI-42",
        supportPhone: "01 02 03",
        supportEmail: "support@edi.fr",
        commercialContact: "Jean Commercial",
        dpoContact: "Dee Pio",
        dpoEmail: "dpo@edi.fr",
      },
    });
    const ct = await prisma.contract.create({ data: { name: "Marché 2026" } });
    const tech = await prisma.referential.findFirst({ where: { kind: "technology" } });
    const sw = await prisma.software.create({
      data: {
        name: "Complet",
        supplierId: sup.id,
        hosting: "saas",
        isDocker: true,
        version: "2.1",
        criticality: 3,
        technologyId: tech?.id ?? null,
        sourceType: "editeur",
        authMode: "ldap",
        authStrong: true,
        usersCount: 120,
        usersMax: 100,
        responsible: "Rita Métier",
        responsibleEmail: "rita@ville.fr",
        techResponsible: "Théo Technique",
        url: "https://appli.ville.fr",
        gdprPersonalData: true,
        gdprCategories: "État civil",
        gdprRegistryRef: "REG-12",
        gdprLocation: "ue",
        description: "Note libre",
        lifecycle: "production",
        contracts: { create: { contractId: ct.id } },
        userServices: { create: { userService: { create: { name: "Ressources humaines" } } } },
      },
    });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    for (const attendu of [
      "Dépassement de licence",
      "2.1",
      "Rita Métier",
      "Théo Technique",
      "2FA",
      "Marché 2026",
      "Ressources humaines",
      "Éditeur",
      "CLI-42",
      "dpo@edi.fr",
      "État civil",
      "REG-12",
      "Interconnexions",
      "Dossiers",
      "Mises à jour liées",
      "Tâches récurrentes",
    ]) {
      expect(html, attendu).toContain(attendu);
    }
  });

  it("la fiche sans éditeur prend toute la largeur", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Maison", internalDev: true } });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).not.toContain("col-lg-3");
    expect(html).not.toContain("ong-rgpd");
    expect(html).toContain('name="gdpr_personal_data"');
    expect(entre(html, 'id="vol-detail"', 'id="vol-details"')).toContain(
      "Aucune donnée personnelle",
    );
  });

  it("la synthèse résume les liaisons", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({ data: { name: "SRV-MAISON", kind: "nas" } });
    const sw = await prisma.software.create({
      data: { name: "Maison", internalDev: true, equipments: { create: { equipmentId: e.id } } },
    });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain("col-lg-3");
    expect(html).toContain("liaisons-resume");
    expect(html).toContain("#hard-drive");
    expect(html).toContain("SRV-MAISON");
  });

  it("l'onglet Détails porte le formulaire", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Concerto" } });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html.indexOf('data-bs-target="#vol-detail"')).toBeLessThan(
      html.indexOf('data-bs-target="#vol-details"'),
    );
    expect(html.indexOf('data-bs-target="#vol-details"')).toBeLessThan(
      html.indexOf('data-bs-target="#vol-liaisons"'),
    );
    expect(html).toContain(`action="/inventory/logiciels/${sw.id}/edit"`);
    expect(html).toContain('name="lifecycle"');
    await c.post(`/inventory/logiciels/${sw.id}/edit`, { name: "Concerto", version: "3.2" });
    expect((await lire(sw.id)).version).toBe("3.2");
  });

  it("les services se cochent depuis la fiche", async () => {
    const c = await clientAdmin();
    const a = await prisma.userService.create({ data: { name: "Finances / Comptabilité" } });
    const b = await prisma.userService.create({ data: { name: "Urbanisme" } });
    const sw = await prisma.software.create({
      data: { name: "GED", userServices: { create: { userServiceId: a.id } } },
    });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain("Urbanisme");
    expect(html).toMatch(
      new RegExp(
        `<input[^>]*value="${a.id}"[^>]*checked|<input[^>]*checked(?:="")?[^>]*value="${a.id}"`,
      ),
    );
    await c.post(
      `/inventory/logiciels/${sw.id}/services`,
      { user_service_ids: [String(b.id)] },
      { followRedirects: true },
    );
    expect(await servicesDe(sw.id)).toEqual(["Urbanisme"]);
    await c.post(`/inventory/logiciels/${sw.id}/services`, {}, { followRedirects: true });
    expect(await servicesDe(sw.id)).toEqual([]);
  });

  it("les serveurs s'associent et se retirent depuis la fiche", async () => {
    const c = await clientAdmin();
    const e1 = await prisma.equipment.create({ data: { name: "SRV-CIRIL", kind: "vm" } });
    await prisma.equipment.create({ data: { name: "SRV-TEST", kind: "vm" } });
    const sw = await prisma.software.create({ data: { name: "GED", noServer: true } });
    let html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain("Choisir un serveur");
    expect(html).toContain(`<option value="${e1.id}">SRV-CIRIL</option>`);
    await c.post(
      `/inventory/logiciels/${sw.id}/servers`,
      { equipment_id: String(e1.id) },
      { followRedirects: true },
    );
    expect(await serveursDe(sw.id)).toEqual(["SRV-CIRIL"]);
    expect((await lire(sw.id)).noServer).toBe(false);
    html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain(">SRV-CIRIL</a>");
    expect(
      html.match(/<select[^>]*name="equipment_id"[\s\S]*?<\/select>/)?.[0] ?? "",
    ).not.toContain(`<option value="${e1.id}">`);
    await c.post(
      `/inventory/logiciels/${sw.id}/servers/${e1.id}/detach`,
      {},
      { followRedirects: true },
    );
    expect(await serveursDe(sw.id)).toEqual([]);
    expect(await prisma.equipment.findUnique({ where: { id: e1.id } })).not.toBeNull();
  });

  it("les certificats s'associent et se retirent depuis la fiche", async () => {
    const c = await clientAdmin();
    const c1 = await prisma.certificate.create({
      data: { serviceName: "Portail famille", domain: "famille.exemple.fr", expiryDate: jour(90) },
    });
    await prisma.certificate.create({
      data: { serviceName: "Messagerie", domain: "mail.exemple.fr", expiryDate: jour(30) },
    });
    const sw = await prisma.software.create({ data: { name: "Portail" } });
    let html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain("Choisir un certificat");
    expect(html).toContain(
      `<option value="${c1.id}">Portail famille - famille.exemple.fr</option>`,
    );
    await c.post(
      `/inventory/logiciels/${sw.id}/certificates`,
      { certificate_id: String(c1.id) },
      { followRedirects: true },
    );
    expect(await certificatsDe(sw.id)).toEqual(["Portail famille"]);
    html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain(`href="/certificates/${c1.id}"`);
    expect(
      html.match(/<select[^>]*name="certificate_id"[\s\S]*?<\/select>/)?.[0] ?? "",
    ).not.toContain(`<option value="${c1.id}">`);
    // Associer deux fois ne crée pas de doublon.
    await c.post(
      `/inventory/logiciels/${sw.id}/certificates`,
      { certificate_id: String(c1.id) },
      { followRedirects: true },
    );
    expect(await certificatsDe(sw.id)).toEqual(["Portail famille"]);
    await c.post(
      `/inventory/logiciels/${sw.id}/certificates/${c1.id}/detach`,
      {},
      { followRedirects: true },
    );
    expect(await certificatsDe(sw.id)).toEqual([]);
    // Retirer le lien ne touche pas au certificat.
    expect(await prisma.certificate.findUnique({ where: { id: c1.id } })).not.toBeNull();
  });

  it("un flux se lit, se corrige et se supprime depuis la fiche", async () => {
    const c = await clientAdmin();
    const a = await prisma.software.create({ data: { name: "Finances" } });
    const b = await prisma.software.create({ data: { name: "iParapheur" } });
    await c.post(
      `/inventory/logiciels/${a.id}/links/add`,
      { other_id: String(b.id), description: "Flux PES" },
      { followRedirects: true },
    );
    const lien = await prisma.softwareLink.findFirstOrThrow();
    const html = (await c.get(`/inventory/logiciels/${a.id}`)).text;
    expect(html).toContain("Interconnexions");
    expect(html).toContain("lucide-arrow-right");
    expect(html).toContain("— Flux PES");
    expect((await c.get(`/inventory/logiciels/${b.id}`)).text).toContain("lucide-arrow-left");
    const r = await c.post(`/inventory/logiciels/links/${lien.id}/edit`, {
      description: "Flux PES - Bons de commande",
      from_id: String(b.id),
    });
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.location ?? "").toMatch(new RegExp(`/inventory/logiciels/${b.id}#liaisons$`));
    expect(
      (await prisma.softwareLink.findUniqueOrThrow({ where: { id: lien.id } })).description,
    ).toBe("Flux PES - Bons de commande");
    await c.post(
      `/inventory/logiciels/links/${lien.id}/delete`,
      { from_id: String(a.id) },
      { followRedirects: true },
    );
    expect(await prisma.softwareLink.count()).toBe(0);
  });

  it("la modale nouveau serveur crée un équipement complet", async () => {
    const c = await clientAdmin();
    const r = await c.post("/inventory/quick-create", {
      name: "SRV-AFFGE",
      kind: "physical",
      os_family: "Windows",
      os: "Windows Server 2022",
      location: "salle serveur",
      observations: "Sauvegarde Veeam",
    });
    expect(r.status).toBe(200);
    expect(r.json<{ ok: boolean }>().ok).toBe(true);
    const eq = await prisma.equipment.findFirstOrThrow({ where: { name: "SRV-AFFGE" } });
    expect(eq.kind).toBe("physical");
    expect(eq.os).toBe("Windows Server 2022");
    expect(eq.location).toBe("salle serveur");
    expect(eq.observations).toBe("Sauvegarde Veeam");
    await c.post("/inventory/quick-create", { name: "SRV-LNX", kind: "vm", os_family: "Linux" });
    expect((await prisma.equipment.findFirstOrThrow({ where: { name: "SRV-LNX" } })).os).toBe(
      "Linux",
    );
    await c.post("/inventory/quick-create", { name: "SRV-VIDE", kind: "vm" });
    expect(
      (await prisma.equipment.findFirstOrThrow({ where: { name: "SRV-VIDE" } })).os,
    ).toBeNull();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain("qaModalServer");
    expect(html).toContain("Nouveau serveur");
    expect(html).toContain("Créer un serveur absent du parc");
  });

  it("le formulaire n'efface pas les rattachements", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({ data: { name: "SRV-GARDE", kind: "vm" } });
    const sv = await prisma.userService.create({ data: { name: "Finances" } });
    const ct = await prisma.contract.create({ data: { name: "Marché gardé" } });
    const sw = await prisma.software.create({
      data: {
        name: "Garde",
        noContractNote: "porté par le CCAS",
        equipments: { create: { equipmentId: e.id } },
        userServices: { create: { userServiceId: sv.id } },
        contracts: { create: { contractId: ct.id } },
      },
    });
    const html = (await c.get(`/inventory/logiciels/${sw.id}/edit`)).text;
    expect(html).not.toContain('name="equipment_ids"');
    expect(html).not.toContain('name="contract_ids"');
    await c.post(`/inventory/logiciels/${sw.id}/edit`, { name: "Garde", version: "2" });
    const maj = await lire(sw.id);
    expect(maj.version).toBe("2");
    expect(await serveursDe(sw.id)).toEqual(["SRV-GARDE"]);
    expect(await servicesDe(sw.id)).toEqual(["Finances"]);
    expect(await contratsDe(sw.id)).toEqual(["Marché gardé"]);
    expect(maj.noContractNote).toBe("porté par le CCAS");
  });

  it("la synthèse ne résume que les contrats en cours", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Tri" } });
    await prisma.contract.create({
      data: {
        name: "Acte courant",
        reference: "COUR-1",
        endDate: jour(90),
        software: { create: { softwareId: sw.id } },
      },
    });
    await prisma.contract.create({
      data: {
        name: "Acte échu",
        reference: "ECHU-1",
        endDate: jour(-30),
        software: { create: { softwareId: sw.id } },
      },
    });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    const synthese = entre(html, 'id="vol-detail"', 'id="vol-details"');
    expect(synthese).toContain("COUR-1");
    expect(synthese).not.toContain("ECHU-1");
    expect(html.split('id="vol-contrats"', 2)[1]).toContain("ECHU-1");
  });

  it("l'ancien formulaire se choisit dans les préférences", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({ data: { name: "SRV-ANCIEN", kind: "vm" } });
    const sw = await prisma.software.create({
      data: { name: "Ancien", equipments: { create: { equipmentId: e.id } } },
    });
    const nouveau = (await c.get(`/inventory/logiciels/${sw.id}/edit`)).text;
    expect(nouveau).toContain("logiciel-saisie");
    expect(nouveau).not.toContain('name="equipment_ids"');
    await c.post("/preferences", { action: "save_forms", software_form_legacy: "on" });
    expect(await reglage("SOFTWARE_FORM_LEGACY")).toBe(true);
    for (const url of [
      `/inventory/logiciels/${sw.id}/edit`,
      `/inventory/logiciels/${sw.id}`,
      "/inventory/logiciels/create",
    ]) {
      const html = (await c.get(url)).text;
      expect(html, url).toContain("form-section form-section--");
      expect(html, url).toContain('name="equipment_ids"');
      expect(html, url).not.toContain("logiciel-saisie");
    }
    await c.post(`/inventory/logiciels/${sw.id}/edit`, { name: "Ancien", equipment_ids: "" });
    expect(await serveursDe(sw.id)).toEqual([]);
    await c.post("/preferences", { action: "save_forms" });
    expect(await reglage("SOFTWARE_FORM_LEGACY")).toBe(false);
  });

  it("la synthèse d'un logiciel suit l'interrupteur du formulaire", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({
      data: { name: "Lu", version: "4.2", isDocker: true },
    });
    let html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain('class="data-card mb-3 synthese synthese--cases"');
    expect(html).toContain("Logiciel</h6>");
    expect(html).not.toContain("Technique</h6>");
    expect(html).toContain("Docker");
    expect(html).toContain("À compléter");
    expect(html).not.toContain('data-manque="Version"');
    expect(html).not.toContain("Hébergement &amp; nature");
    await c.post("/preferences", { action: "save_forms", software_form_legacy: "on" });
    html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).not.toContain("synthese");
    expect(html).toContain("Hébergement &amp; nature");
    await c.post("/preferences", { action: "save_forms" });
  });

  it("l'onglet Contacts reprend ceux de l'éditeur", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({
      data: {
        name: "Arpège",
        supportPhone: "0123456789",
        supportEmail: "aide@arpege.fr",
        commercialContact: "Jean Vendeur",
        dpoEmail: "dpo@arpege.fr",
      },
    });
    const sw = await prisma.software.create({ data: { name: "Concerto", supplierId: sup.id } });
    const seul = await prisma.software.create({ data: { name: "Maison", internalDev: true } });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    const volet = entre(html, 'id="vol-contacts"', 'id="vol-liaisons"');
    expect(html.indexOf('data-bs-target="#vol-details"')).toBeLessThan(
      html.indexOf('data-bs-target="#vol-contacts"'),
    );
    expect(html.indexOf('data-bs-target="#vol-contacts"')).toBeLessThan(
      html.indexOf('data-bs-target="#vol-liaisons"'),
    );
    expect(volet).toContain("Contacts — Arpège");
    expect(volet).toContain("Jean Vendeur");
    expect(volet).toContain("dpo@arpege.fr");
    expect(volet).toContain('href="tel:0123456789">01 23 45 67 89</a>');
    expect(volet).not.toContain("Contact commercial 2");
    expect(volet).not.toContain("name=");
    expect((await c.get(`/inventory/logiciels/${seul.id}`)).text).toContain(
      "Aucun éditeur n&#x27;est rattaché à ce logiciel",
    );
  });
});
