/** Marchés : rattachement N-N aux logiciels, documents, consultations et devis (port de tests/test_marches.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { contractKindLabel, contractPeriodLabel, contractRenewalLabel } from "@/lib/statuts";
import { marchesRattachables } from "@/modules/software/server";
import { migrateContractKinds } from "@/server/amorcage";
import { clientAdmin } from "./setup/client";
import { jour, prisma, reglage, resetDb } from "./setup/db";
import { optionSelectionnee } from "./setup/html";

beforeEach(resetDb);

const d = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));
const contratsDe = async (softwareId: number) =>
  (
    await prisma.contractSoftware.findMany({ where: { softwareId }, include: { contract: true } })
  ).map((x) => x.contract.name);
const logicielsDe = async (contractId: number) =>
  (
    await prisma.contractSoftware.findMany({ where: { contractId }, include: { software: true } })
  ).map((x) => x.software.name);
const deposer = (
  c: Awaited<ReturnType<typeof clientAdmin>>,
  ctId: number,
  nom: string,
  champs: Record<string, string> = {},
) =>
  c.post(
    "/documents/upload",
    { parent_kind: "contract", parent_id: String(ctId), ...champs },
    { files: { file: { name: nom, content: "%PDF-1.4 acte" } }, followRedirects: true },
  );

describe("marchés", () => {
  it("un marché couvre plusieurs logiciels", async () => {
    const c = await clientAdmin();
    const a = await prisma.software.create({ data: { name: "Concerto" } });
    const b = await prisma.software.create({ data: { name: "Concerto Opus" } });
    await c.post(
      "/contracts/create",
      {
        name: "Marché UGAP 2027",
        nature: "marche",
        reference: "M-2027-04",
        supplier_reference: "CMD-99812",
        cost_yearly: "12000",
        cost_max_yearly: "15000",
        cost_total: "48000",
        start_date: "2027-01-01",
        end_date: "2030-12-31",
        firm_years: "2",
        renewals: "2",
        renewal_years: "1",
        software_ids: [String(a.id), String(b.id)],
      },
      { followRedirects: true },
    );
    const ct = await prisma.contract.findFirstOrThrow({ where: { name: "Marché UGAP 2027" } });
    expect(new Set(await logicielsDe(ct.id))).toEqual(new Set(["Concerto", "Concerto Opus"]));
    expect(ct.nature).toBe("marche");
    expect(ct.supplierReference).toBe("CMD-99812");
    expect(Number(ct.costMaxYearly)).toBe(15000);
    expect(Number(ct.costTotal)).toBe(48000);
    expect([ct.firmYears, ct.renewals, ct.renewalYears]).toEqual([2, 2, 1]);
    expect(await contratsDe(a.id)).toEqual(["Marché UGAP 2027"]);
  });

  it("créer un marché depuis un logiciel le coche", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Sygal" } });
    const autre = await prisma.software.create({ data: { name: "Autre" } });
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).toContain(
      `/contracts/create?software_id=${sw.id}`,
    );
    const html = (await c.get(`/contracts/create?software_id=${sw.id}&inline=1`)).text;
    expect(optionSelectionnee(html, `software:${sw.id}`)).toBe(true);
    expect(optionSelectionnee(html, `software:${autre.id}`)).toBe(false);
  });

  it("supprimer un logiciel ne supprime pas le marché", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Éphémère" } });
    await prisma.contract.create({
      data: { name: "Marché commun", software: { create: { softwareId: sw.id } } },
    });
    await c.post(`/inventory/logiciels/${sw.id}/delete`, {}, { followRedirects: true });
    expect(
      (await prisma.contract.findFirstOrThrow({ where: { name: "Marché commun" } })).isActive,
    ).toBe(true);
  });

  it("période et reconductions se lisent en français", () => {
    const base = {
      kind: null,
      kindRef: null,
      startDate: null,
      endDate: null,
      noticeDays: null,
      renewals: null,
      renewalYears: null,
    };
    expect(contractPeriodLabel(base)).toBe("");
    expect(contractPeriodLabel({ ...base, startDate: d(2023, 1, 1) })).toBe("depuis le 01/01/2023");
    expect(
      contractPeriodLabel({ ...base, startDate: d(2023, 1, 1), endDate: d(2026, 12, 31) }),
    ).toBe("du 01/01/2023 au 31/12/2026");
    expect(contractRenewalLabel(base)).toBe("");
    expect(contractRenewalLabel({ ...base, renewals: 0 })).toBe("non reconductible");
    expect(contractRenewalLabel({ ...base, renewals: 2, renewalYears: 1 })).toBe(
      "renouvelable 2 fois par période de 1 an",
    );
  });

  it("les documents du marché portent une date", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Marché RH", costYearly: 10000 } });
    await deposer(c, ct.id, "bon-de-commande.pdf", { doc_date: "2026-02-10" });
    await deposer(c, ct.id, "avenant.pdf");
    const docs = await prisma.document.findMany({ where: { contractId: ct.id } });
    expect(new Set(docs.map((x) => x.filename))).toEqual(
      new Set(["bon-de-commande.pdf", "avenant.pdf"]),
    );
    expect(
      docs
        .find((x) => x.filename === "bon-de-commande.pdf")
        ?.docDate?.toISOString()
        .slice(0, 10),
    ).toBe("2026-02-10");
    const html = (await c.get(`/contracts/${ct.id}`)).text;
    expect(html).not.toContain("ong-pieces-du");
    expect(html).toContain('name="doc_date"');
    expect(html).not.toContain('name="amount"');
  });

  it("consultation et devis retenu", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const s1 = await prisma.supplier.create({ data: { name: "Éditeur A" } });
    await c.post(
      `/contracts/consultations/${sw.id}/add`,
      { subject: "Renouvellement 2027", date: "2026-09-01" },
      { followRedirects: true },
    );
    const cons = await prisma.consultation.findFirstOrThrow();
    expect(cons.softwareId).toBe(sw.id);
    expect(
      await prisma.quote.findFirst({ where: { consultationId: cons.id, selected: true } }),
    ).toBeNull();
    await c.post(
      `/contracts/consultations/${cons.id}/quotes/add`,
      { supplier_id: String(s1.id), amount: "9000", date: "2026-09-15" },
      { followRedirects: true },
    );
    await c.post(
      `/contracts/consultations/${cons.id}/quotes/add`,
      { supplier_name: "SSII locale", amount: "7500" },
      { followRedirects: true },
    );
    expect(await prisma.quote.count({ where: { consultationId: cons.id } })).toBe(2);
    const libre = await prisma.quote.findFirstOrThrow({ where: { supplierName: "SSII locale" } });
    expect(libre.supplierId).toBeNull();
    await c.post(`/contracts/quotes/${libre.id}/select`, {}, { followRedirects: true });
    expect(
      (await prisma.quote.findFirstOrThrow({ where: { consultationId: cons.id, selected: true } }))
        .id,
    ).toBe(libre.id);
  });

  it("au plus un devis retenu par consultation", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const cons = await prisma.consultation.create({
      data: { softwareId: sw.id, subject: "Migration" },
    });
    const a = await prisma.quote.create({
      data: { consultationId: cons.id, supplierName: "A", amount: 100 },
    });
    const b = await prisma.quote.create({
      data: { consultationId: cons.id, supplierName: "B", amount: 200 },
    });
    await c.post(`/contracts/quotes/${a.id}/select`, {}, { followRedirects: true });
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: a.id } })).selected).toBe(true);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: b.id } })).selected).toBe(false);
    await c.post(`/contracts/quotes/${b.id}/select`, {}, { followRedirects: true });
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: a.id } })).selected).toBe(false);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: b.id } })).selected).toBe(true);
    expect(await prisma.quote.count({ where: { consultationId: cons.id, selected: true } })).toBe(
      1,
    );
  });

  it("supprimer une consultation emporte ses devis", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const cons = await prisma.consultation.create({
      data: { softwareId: sw.id, subject: "Acquisition" },
    });
    await prisma.quote.create({ data: { consultationId: cons.id, supplierName: "A" } });
    await c.post(`/contracts/consultations/${cons.id}/delete`, {}, { followRedirects: true });
    expect(await prisma.consultation.count()).toBe(0);
    expect(await prisma.quote.count()).toBe(0);
  });

  it("rattacher un marché depuis la fiche logiciel", async () => {
    const c = await clientAdmin();
    const ed = await prisma.supplier.create({ data: { name: "Arpege" } });
    const sw = await prisma.software.create({ data: { name: "Concerto Opus", supplierId: ed.id } });
    const ct = await prisma.contract.create({ data: { name: "Marché M20-23", supplierId: ed.id } });
    await c.post(
      `/contracts/software/${sw.id}/attach`,
      { contract_id: String(ct.id) },
      { followRedirects: true },
    );
    expect(await contratsDe(sw.id)).toEqual(["Marché M20-23"]);
    await c.post(`/contracts/${ct.id}/software/${sw.id}/detach`, {}, { followRedirects: true });
    expect(await contratsDe(sw.id)).toEqual([]);
    expect(
      (await prisma.contract.findFirstOrThrow({ where: { name: "Marché M20-23" } })).isActive,
    ).toBe(true);
  });

  it("les marchés proposés sont ceux de l'éditeur et les orphelins", async () => {
    const ed = await prisma.supplier.create({ data: { name: "Arpege" } });
    const autre = await prisma.supplier.create({ data: { name: "Berger-Levrault" } });
    const sw = await prisma.software.create({ data: { name: "Concerto Opus", supplierId: ed.id } });
    const voisin = await prisma.software.create({ data: { name: "Voisin", supplierId: autre.id } });
    const famille = await prisma.contract.create({
      data: { name: "Marché de la famille", supplierId: ed.id },
    });
    await prisma.contract.create({ data: { name: "Marché sans logiciel" } });
    await prisma.contract.create({
      data: {
        name: "Marché d'un autre éditeur",
        supplierId: autre.id,
        software: { create: { softwareId: voisin.id } },
      },
    });
    expect(new Set((await marchesRattachables(sw)).map((x) => x.name))).toEqual(
      new Set(["Marché de la famille", "Marché sans logiciel"]),
    );
    await prisma.contractSoftware.create({ data: { contractId: famille.id, softwareId: sw.id } });
    expect(new Set((await marchesRattachables(sw)).map((x) => x.name))).toEqual(
      new Set(["Marché sans logiciel"]),
    );
  });

  it("la fiche logiciel liste les documents du marché", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Paie" } });
    const ct = await prisma.contract.create({
      data: {
        name: "Marché RH",
        reference: "M26-01",
        costYearly: 10000,
        software: { create: { softwareId: sw.id } },
      },
    });
    await deposer(c, ct.id, "marche-signe.pdf", { doc_date: "2026-02-10" });
    await deposer(c, ct.id, "avenant.pdf");
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain("2 Documents");
    expect(html).toContain("marche-signe.pdf");
    expect(html).toContain("avenant.pdf");
    expect(html).toContain("10/02/2026");
    expect(html).toContain("M26-01");
    expect(html).toContain("Mnt annuel : 10 000 €");
  });

  it("déposer une pièce depuis la fiche logiciel y revient", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Paie" } });
    const ct = await prisma.contract.create({
      data: { name: "Marché RH", software: { create: { softwareId: sw.id } } },
    });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain(`docDepot${ct.id}`);
    expect(html).toContain("0 Document");
    expect(html).toContain("Aucun document pour ce contrat.");
    const r = await c.post(
      "/documents/upload",
      {
        parent_kind: "contract",
        parent_id: String(ct.id),
        next: `/inventory/logiciels/${sw.id}#contrats`,
      },
      { files: { file: { name: "acte.pdf", content: "%PDF-1.4 acte" } } },
    );
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.location ?? "").toMatch(new RegExp(`/inventory/logiciels/${sw.id}#contrats$`));
    expect(
      (await prisma.document.findFirstOrThrow({ where: { contractId: ct.id } })).filename,
    ).toBe("acte.pdf");
  });

  it("les éléments couverts dans une seule liste", async () => {
    const c = await clientAdmin();
    const a = await prisma.software.create({ data: { name: "Concerto" } });
    const e = await prisma.equipment.create({ data: { name: "SRV-CONCERTO", kind: "vm" } });
    await c.post(
      "/contracts/create",
      {
        name: "Maintenance Concerto",
        covered_ids: [`software:${a.id}`, `equipment:${e.id}`, "bidon:9", "software:"],
      },
      { followRedirects: true },
    );
    const ct = await prisma.contract.findFirstOrThrow({ where: { name: "Maintenance Concerto" } });
    expect(await logicielsDe(ct.id)).toEqual(["Concerto"]);
    expect(
      (
        await prisma.contractEquipment.findMany({
          where: { contractId: ct.id },
          include: { equipment: true },
        })
      ).map((x) => x.equipment.name),
    ).toEqual(["SRV-CONCERTO"]);
    const html = (await c.get(`/contracts/${ct.id}/edit`)).text;
    expect(optionSelectionnee(html, `software:${a.id}`)).toBe(true);
    expect(optionSelectionnee(html, `equipment:${e.id}`)).toBe(true);
    const optE = html.match(new RegExp(`<option[^>]*value="equipment:${e.id}"[^>]*>`))?.[0] ?? "";
    expect(optE).toContain('data-icone="monitor"');
    expect(optE).toContain('data-kind="vm"');
    expect(optE).toContain(`data-url="/inventory/${e.id}"`);
    expect(optE).toContain('title="VM"');
    const optA = html.match(new RegExp(`<option[^>]*value="software:${a.id}"[^>]*>`))?.[0] ?? "";
    expect(optA).toContain('data-kind="software"');
    expect(optA).toContain(`data-url="/inventory/logiciels/${a.id}"`);
    expect(html).toContain('<optgroup label="Matériel" data-icone="server">');
    expect(html).toContain('<optgroup label="Logiciel" data-icone="app-window">');
  });

  it("l'onglet Détails porte le formulaire", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Maintenance Concerto" } });
    const html = (await c.get(`/contracts/${ct.id}`)).text;
    expect(html.indexOf('data-bs-target="#vol-detail"')).toBeLessThan(
      html.indexOf('data-bs-target="#vol-details"'),
    );
    expect(html.indexOf('data-bs-target="#vol-details"')).toBeLessThan(
      html.indexOf('data-bs-target="#vol-historique"'),
    );
    expect(html).toContain(`action="/contracts/${ct.id}/edit"`);
    expect(html).toContain('name="covered_ids"');
    expect(html).toContain("data-edition");
    expect(html).toContain("js-edition");
    expect(html).not.toContain("js-modifier");
    expect(html).toMatch(
      /<fieldset class="edition-verrou" data-edition-verrou(?:="[^"]*")? disabled(?:="")?>/,
    );
    const fragment = (await c.get(`/contracts/${ct.id}/edit?inline=1`)).text;
    expect(fragment).toMatch(/class="formulaire marche-saisie" data-edition-visible(?:="[^"]*")?>/);
  });

  it("le formulaire se rend seul dans une liste", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/contracts/create?inline=1")).text;
    expect(html).not.toContain("<html");
    expect(html).not.toContain("form-pied");
    expect(html).toContain('id="form-principal"');
    expect(html).toContain("data-formulaire-fermer");
    const erreur = (await c.post("/contracts/create?inline=1", { name: "" })).text;
    expect(erreur).not.toContain("<html");
    expect(erreur).toContain("Le nom du contrat est obligatoire.");
    const page = (await c.get("/contracts/create")).text;
    expect(page).toContain("<html");
    expect(page).toContain("form-pied");
  });

  it("le type de contrat est un référentiel", async () => {
    const c = await clientAdmin();
    const types = await prisma.referential.findMany({
      where: { kind: "contract_kind", isActive: true },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    });
    expect(types.map((t) => t.label)).toEqual([
      "Maintenance",
      "Licence",
      "Abonnement",
      "Marché public",
      "Autre",
    ]);
    const html = (await c.get("/contracts/create")).text;
    expect(html).toContain('name="kind_id"');
    expect(html).not.toContain('name="kind"');
    const licence = types.find((t) => t.label === "Licence");
    await c.post(
      "/contracts/create",
      { name: "Office 365", kind_id: String(licence?.id) },
      { followRedirects: true },
    );
    const ct = await prisma.contract.findFirstOrThrow({
      where: { name: "Office 365" },
      include: { kindRef: true },
    });
    expect(ct.kindId).toBe(licence?.id);
    expect(contractKindLabel(ct)).toBe("Licence");
    await c.post(
      `/contracts/${ct.id}/edit`,
      { name: "Office 365", kind_id: "999999" },
      { followRedirects: true },
    );
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: ct.id } })).kindId).toBeNull();
  });

  it("l'ancien type est repris dans le référentiel", async () => {
    const autre = await prisma.referential.findFirstOrThrow({
      where: { kind: "contract_kind", label: "Autre" },
    });
    await prisma.referential.delete({ where: { id: autre.id } });
    await prisma.contract.createMany({
      data: [
        { name: "Ancien", kind: "licence" },
        { name: "Orphelin", kind: "other" },
        { name: "Inconnu", kind: "bidon" },
      ],
    });
    await migrateContractKinds();
    expect(
      contractKindLabel(
        await prisma.contract.findFirstOrThrow({
          where: { name: "Ancien" },
          include: { kindRef: true },
        }),
      ),
    ).toBe("Licence");
    const orphelin = await prisma.contract.findFirstOrThrow({
      where: { name: "Orphelin" },
      include: { kindRef: true },
    });
    expect(contractKindLabel(orphelin)).toBe("Autre");
    expect(orphelin.kindRef?.kind).toBe("contract_kind");
    expect(
      (await prisma.contract.findFirstOrThrow({ where: { name: "Inconnu" } })).kindId,
    ).toBeNull();
  });

  it("la durée ferme va de 1 à 4 ans", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/contracts/create")).text;
    expect(html).toContain('<option value="4"');
    expect(html).not.toContain('<option value="5"');
    await c.post(
      "/contracts/create",
      { name: "Court", firm_years: "3" },
      { followRedirects: true },
    );
    expect((await prisma.contract.findFirstOrThrow({ where: { name: "Court" } })).firmYears).toBe(
      3,
    );
    await c.post(
      "/contracts/create",
      { name: "Trop long", firm_years: "7", renewal_years: "5", renewals: "4" },
      { followRedirects: true },
    );
    const trop = await prisma.contract.findFirstOrThrow({ where: { name: "Trop long" } });
    expect([trop.firmYears, trop.renewalYears, trop.renewals]).toEqual([null, null, null]);
    await c.post(
      `/contracts/${trop.id}/edit`,
      { name: "Trop long", renewal_years: "4", notice_days: "400" },
      { followRedirects: true },
    );
    const maj = await prisma.contract.findUniqueOrThrow({ where: { id: trop.id } });
    expect(maj.renewalYears).toBe(4);
    expect(maj.noticeDays).toBe(365);
  });

  it("la tacite reconduction est cochée par défaut", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/contracts/create")).text;
    expect(html).toMatch(/<input[^>]*id="autoRenew"[^>]*checked/);
    const ct = await prisma.contract.create({ data: { name: "Sec", autoRenew: false } });
    expect((await c.get(`/contracts/${ct.id}/edit`)).text).not.toMatch(
      /<input[^>]*id="autoRenew"[^>]*checked/,
    );
  });

  it("l'ancien formulaire de contrat se choisit dans les préférences", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({ data: { name: "SRV-ACTE", kind: "vm" } });
    const ct = await prisma.contract.create({ data: { name: "Acte ancien" } });
    await c.post("/preferences", { action: "save_forms", contract_form_legacy: "on" });
    expect(await reglage("CONTRACT_FORM_LEGACY")).toBe(true);
    for (const url of [`/contracts/${ct.id}/edit`, `/contracts/${ct.id}`, "/contracts/create"]) {
      const html = (await c.get(url)).text;
      expect(html, url).toContain("form-section form-section--");
      expect(html, url).toContain('name="equipment_ids"');
      expect(html, url).not.toContain("marche-saisie");
    }
    expect((await c.get(`/contracts/${ct.id}/edit?inline=1`)).text).toContain("marche-saisie");
    await c.post(`/contracts/${ct.id}/edit`, {
      name: "Acte ancien",
      equipment_ids: [String(e.id)],
      firm_years: "3",
      notice_days: "60",
    });
    const maj = await prisma.contract.findUniqueOrThrow({ where: { id: ct.id } });
    expect(
      (
        await prisma.contractEquipment.findMany({
          where: { contractId: ct.id },
          include: { equipment: true },
        })
      ).map((x) => x.equipment.name),
    ).toEqual(["SRV-ACTE"]);
    expect(maj.firmYears).toBe(3);
    await c.post("/preferences", { action: "save_forms" });
    expect(await reglage("CONTRACT_FORM_LEGACY")).toBe(false);
  });

  it("la synthèse d'un contrat suit l'interrupteur du formulaire", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({ data: { name: "SRV-COUVERT", kind: "nas" } });
    const sw = await prisma.software.create({ data: { name: "Logiciel couvert" } });
    const ct = await prisma.contract.create({
      data: {
        name: "Acte lu",
        costYearly: 1234.5,
        renewals: 2,
        equipments: { create: { equipmentId: e.id } },
        software: { create: { softwareId: sw.id } },
      },
    });
    let html = (await c.get(`/contracts/${ct.id}`)).text;
    expect(html).toContain('class="data-card mb-3 synthese synthese--cases"');
    expect(html).toContain("Éléments couverts");
    expect(html).toContain("kind-icon--nas");
    expect(html).toContain("kind-icon--software");
    expect(html).toContain("1 234,50 €");
    expect(html).toContain("2 fois");
    expect(html).not.toContain("Couvre");
    expect(html).not.toContain("fiche-sections");
    await c.post("/preferences", { action: "save_forms", contract_form_legacy: "on" });
    html = (await c.get(`/contracts/${ct.id}`)).text;
    expect(html).not.toContain("synthese");
    expect(html).toContain("fiche-sections");
    expect(html).toContain("Couvre");
    await c.post("/preferences", { action: "save_forms" });
  });

  it("un contrat est en cours quand il a commencé et n'est pas échu", async () => {
    const { contractEnCours } = await import("@/lib/statuts");
    const base = {
      kind: null,
      kindRef: null,
      startDate: null,
      endDate: null,
      noticeDays: null,
      renewals: null,
      renewalYears: null,
    };
    expect(contractEnCours(base)).toBe(true);
    expect(contractEnCours({ ...base, startDate: jour(-10), endDate: jour(10) })).toBe(true);
    expect(contractEnCours({ ...base, endDate: jour(0) })).toBe(true);
    expect(contractEnCours({ ...base, endDate: jour(-1) })).toBe(false);
    expect(contractEnCours({ ...base, startDate: jour(1) })).toBe(false);
  });
});
