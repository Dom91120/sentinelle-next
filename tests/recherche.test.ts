/** Recherche globale : logiciels, devis, pièces jointes, et le droit de lecture de chaque catégorie (port de tests/test_recherche.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { ClientTest, clientAdmin } from "./setup/client";
import { creerUtilisateur, prisma, regler, resetDb } from "./setup/db";

beforeEach(resetDb);

const rechercher = async (c: ClientTest, q: string) =>
  (await c.get(`/search?q=${encodeURIComponent(q)}`)).text;
const piece = (parent: Record<string, number>) =>
  prisma.document.create({
    data: {
      filename: "acte-engagement.pdf",
      size: 2048,
      ...parent,
      content: { create: { data: new Uint8Array(Buffer.from("%PDF-1.4")) } },
    },
  });

describe("recherche", () => {
  it("un logiciel se trouve par son nom et mène à sa fiche", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Genesis", version: "4.2" } });
    const html = await rechercher(c, "genes");
    expect(html).toContain("Genesis 4.2");
    expect(html).toContain(`/inventory/logiciels/${sw.id}`);
    expect(html).toContain("logiciel");
  });

  it("un logiciel se trouve par son éditeur et son responsable", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({ data: { name: "Berger-Levrault" } });
    await prisma.software.create({
      data: { name: "e.magnus", supplierId: sup.id, responsible: "Martine Dupuis" },
    });
    expect(await rechercher(c, "berger")).toContain("e.magnus");
    expect(await rechercher(c, "dupuis")).toContain("e.magnus");
  });

  it("la recherche ignore la casse et les accents", async () => {
    const c = await clientAdmin();
    await prisma.software.create({
      data: { name: "Gestion des élections", description: "Châtillon" },
    });
    expect(await rechercher(c, "ELECTIONS")).toContain("Gestion des élections");
    expect(await rechercher(c, "chatillon")).toContain("Gestion des élections");
    expect(await rechercher(c, "Châtillon")).toContain("Gestion des élections");
  });

  it("un certificat électronique se trouve par son titulaire, un contrat par sa référence fournisseur", async () => {
    const c = await clientAdmin();
    const cert = await prisma.certificate.create({
      data: { kind: "signature", serviceName: "DSI", holder: "ROLLAND", firstName: "David" },
    });
    const sup = await prisma.supplier.create({
      data: { name: "Arpège", dpoEmail: "dpo@arpege.fr" },
    });
    const ct = await prisma.contract.create({
      data: { name: "Maintenance", supplierId: sup.id, supplierReference: "ARP-2026-17" },
    });
    expect(await rechercher(c, "rolland")).toContain(`/certificates/${cert.id}`);
    expect(await rechercher(c, "arp-2026")).toContain(`/contracts/${ct.id}`);
    // Les fiches liées comptent : le contrat se trouve par son fournisseur, le fournisseur par le courriel de son DPO.
    expect(await rechercher(c, "arpege")).toContain(`/contracts/${ct.id}`);
    expect(await rechercher(c, "dpo@arpege")).toContain(`/suppliers/${sup.id}`);
  });

  it("un logiciel se trouve par le serveur, le service et le contrat qui lui sont liés", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Portail famille" } });
    const srv = await prisma.equipment.create({ data: { name: "SRV-PORTAIL", kind: "vm" } });
    const svc = await prisma.userService.create({ data: { name: "Petite enfance" } });
    const ct = await prisma.contract.create({ data: { name: "Hébergement portail" } });
    await prisma.softwareEquipment.create({ data: { softwareId: sw.id, equipmentId: srv.id } });
    await prisma.softwareService.create({ data: { softwareId: sw.id, userServiceId: svc.id } });
    await prisma.contractSoftware.create({ data: { softwareId: sw.id, contractId: ct.id } });
    for (const q of ["srv-portail", "petite enfance", "hebergement portail"])
      expect(await rechercher(c, q), q).toContain(`/inventory/logiciels/${sw.id}`);
    // Et le matériel se trouve par le logiciel qu'il héberge.
    expect(await rechercher(c, "portail famille")).toContain(`/inventory/${srv.id}`);
  });

  it("un logiciel à la corbeille ne se trouve pas", async () => {
    const c = await clientAdmin();
    await prisma.software.create({ data: { name: "Antique", isActive: false } });
    expect(await rechercher(c, "antiq")).not.toContain("Antique");
  });

  it("un devis se trouve par la société et mène à l'onglet devis", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const cons = await prisma.consultation.create({
      data: { softwareId: sw.id, subject: "Renouvellement 2026" },
    });
    await prisma.quote.create({
      data: { consultationId: cons.id, supplierName: "Docuware SAS", amount: 12500 },
    });
    const html = await rechercher(c, "docuware");
    expect(html).toContain("Docuware SAS");
    expect(html).toContain("Renouvellement 2026");
    expect(html).toContain(`/inventory/logiciels/${sw.id}#devis`);
    expect(await rechercher(c, "renouvellement")).toContain("Docuware SAS");
  });

  it("une pièce jointe se trouve par son nom et mène à sa fiche", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Marché GED" } });
    await piece({ contractId: ct.id });
    const html = await rechercher(c, "engagement");
    expect(html).toContain("acte-engagement.pdf");
    expect(html).toContain("Contrat Marché GED");
    expect(html).toContain(`/contracts/${ct.id}#documents`);
  });

  it("une pièce jointe se trouve par sa catégorie", async () => {
    const c = await clientAdmin();
    const cat = await prisma.referential.findFirst({
      where: { kind: "doc_category", label: "Délibération" },
    });
    expect(cat).not.toBeNull();
    const sw = await prisma.software.create({ data: { name: "Paie" } });
    await piece({ softwareId: sw.id, categoryId: cat?.id ?? 0 });
    expect(await rechercher(c, "délib")).toContain("acte-engagement.pdf");
  });

  it("une pièce dont la fiche est à la corbeille ne se trouve pas", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Vieux", isActive: false } });
    await piece({ softwareId: sw.id });
    expect(await rechercher(c, "engagement")).not.toContain("acte-engagement.pdf");
  });

  it("les pièces jointes disparaissent quand le module est coupé", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Paie" } });
    await piece({ softwareId: sw.id });
    expect(await rechercher(c, "engagement")).toContain("acte-engagement.pdf");
    await regler({ DOCUMENTS_ENABLED: false });
    expect(await rechercher(c, "engagement")).not.toContain("acte-engagement.pdf");
  });

  it("sans droit inventaire : ni logiciel ni sa pièce, mais le contrat reste", async () => {
    const sw = await prisma.software.create({ data: { name: "Sésame" } });
    await prisma.contract.create({ data: { name: "Sésame maintenance" } });
    await piece({ softwareId: sw.id });
    const cons = await prisma.consultation.create({
      data: { softwareId: sw.id, subject: "Sésame devis" },
    });
    await prisma.quote.create({
      data: { consultationId: cons.id, supplierName: "Sésame Éditions" },
    });
    await creerUtilisateur("restreint", "Restreint-2026!", "restreint", {
      inventory: 0,
      contracts: 1,
    });
    const c = new ClientTest();
    await c.login("restreint", "Restreint-2026!");
    const html = await rechercher(c, "sésame");
    expect(html).toContain("Sésame maintenance");
    expect(html).toContain("Sésame Éditions");
    expect(html).not.toContain(`/inventory/logiciels/${sw.id}"`);
    expect(html).not.toContain("acte-engagement.pdf");
  });
});
