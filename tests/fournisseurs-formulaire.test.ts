/** Fournisseurs : onglet Détails, nouveau formulaire, Synthèse et l'ancien formulaire (port de tests/test_fournisseurs_formulaire.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { clientAdmin } from "./setup/client";
import { prisma, reglage, regler, resetDb } from "./setup/db";
import { entre } from "./setup/html";

beforeEach(resetDb);

/** La lecture de l'onglet Contacts (avant son formulaire). */
const contactsLus = (html: string) =>
  html.split('id="vol-contacts"', 2)[1].split('id="form-contacts"', 2)[0];

const CHAMPS: Record<string, string> = {
  name: "Arpège",
  kind: "provider",
  website: "https://arpege.fr",
  contact_name: "Léa",
  email: "contact@arpege.fr",
  phone: "0102030405",
  address: "1 rue du Port",
  postal_code: "44000",
  city: "Nantes",
  support_url: "https://aide.arpege.fr",
  support_phone: "0800000000",
  support_email: "aide@arpege.fr",
  customer_ref: "CLI-9",
  hours: "8h-18h",
  hours2: "samedi 9h-12h",
  commercial_contact: "DUPONT",
  commercial_phone: "0600000001",
  commercial_email: "dupont@arpege.fr",
  commercial2_contact: "MOREAU",
  commercial2_phone: "0600000002",
  commercial2_email: "moreau@arpege.fr",
  admin_contact: "Compta",
  admin_phone: "0600000003",
  admin_email: "factu@arpege.fr",
  dpo_contact: "Martin",
  dpo_phone: "0600000004",
  dpo_email: "dpo@arpege.fr",
  notes: "Escalade au N2 après 4 h.",
};
const d = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));
const synthese = (html: string) => entre(html, 'id="vol-detail"', 'id="vol-details"');

describe("fournisseurs", () => {
  it("le nouveau formulaire porte tous les champs", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({ data: { name: "Arpège" } });
    // Les champs de l'onglet Contacts (assistance et contacts) ne sont pas dans Détails.
    const ONGLET = Object.keys(CHAMPS).filter((k) =>
      /^(support_|customer_ref|hours|commercial|admin_|dpo_)/.test(k),
    );
    const DETAILS = Object.keys(CHAMPS).filter((k) => !ONGLET.includes(k));
    for (const url of [`/suppliers/${sup.id}/edit`, `/suppliers/${sup.id}`, "/suppliers/create"]) {
      const html = (await c.get(url)).text;
      expect(html, url).toContain("fournisseur-saisie");
      for (const champ of DETAILS) expect(html, `${url} ${champ}`).toContain(`name="${champ}"`);
      expect(html, url).not.toContain("form-section form-section--");
    }
    const fiche = (await c.get(`/suppliers/${sup.id}`)).text;
    const formContacts = fiche.split('id="form-contacts"', 2)[1];
    for (const champ of ONGLET) expect(formContacts, champ).toContain(`name="${champ}"`);
    for (const champ of ONGLET)
      expect(fiche.split('id="form-contacts"', 2)[0], champ).not.toContain(`name="${champ}"`);
  });

  it("le nouveau formulaire enregistre et la synthèse relit", async () => {
    const c = await clientAdmin();
    let sup = await prisma.supplier.create({ data: { name: "Arpège" } });
    await c.post(`/suppliers/${sup.id}/edit`, CHAMPS);
    sup = await prisma.supplier.findUniqueOrThrow({ where: { id: sup.id } });
    expect(sup.commercialContact2).toBe("MOREAU");
    expect(sup.dpoEmail).toBe("dpo@arpege.fr");
    expect(sup.customerRef).toBe("CLI-9");
    expect(sup.hours2).toBe("samedi 9h-12h");
    const html = (await c.get(`/suppliers/${sup.id}`)).text;
    const s = synthese(html);
    expect(s).toContain('class="data-card mb-3 synthese synthese--cases"');
    expect(s).toContain("Nantes");
    // L'assistance et les contacts vivent dans leur onglet, pas dans la synthèse ni dans Détails.
    for (const v of ["MOREAU", "factu@arpege.fr", "CLI-9"]) expect(s).not.toContain(v);
    const contacts = html.split('id="vol-contacts"', 2)[1];
    for (const v of ["MOREAU", "factu@arpege.fr", "CLI-9", "aide@arpege.fr"])
      expect(contacts).toContain(v);
    expect(contacts).toContain(`action="/suppliers/${sup.id}/contacts"`);
    expect(html).toContain('id="ong-contacts"');
    expect(html).toContain('id="ong-details"');
    expect(html.split('id="vol-details"', 2)[1].split('id="vol-contacts"', 2)[0]).not.toContain(
      'name="commercial_contact"',
    );
  });

  it("l'ancien formulaire des fournisseurs se choisit dans les préférences", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({
      data: { name: "Arpège", commercialContact: "DUPONT" },
    });
    await c.post("/preferences", { action: "save_forms", supplier_form_legacy: "on" });
    expect(await reglage("SUPPLIER_FORM_LEGACY")).toBe(true);
    for (const url of [`/suppliers/${sup.id}/edit`, `/suppliers/${sup.id}`, "/suppliers/create"]) {
      const html = (await c.get(url)).text;
      expect(html, url).toContain("form-section form-section--");
      expect(html, url).not.toContain("fournisseur-saisie");
    }
    const html = (await c.get(`/suppliers/${sup.id}`)).text;
    expect(html).not.toContain("synthese");
    expect(html).toContain("fiche-faits");
    expect(html).toContain('id="ong-contacts"');
    await c.post(`/suppliers/${sup.id}/edit`, { ...CHAMPS, name: "Arpège ancien" });
    expect((await prisma.supplier.findUniqueOrThrow({ where: { id: sup.id } })).name).toBe(
      "Arpège ancien",
    );
    await c.post("/preferences", { action: "save_forms" });
    expect(await reglage("SUPPLIER_FORM_LEGACY")).toBe(false);
  });

  it("l'onglet Contacts tait les contacts vides", async () => {
    const c = await clientAdmin();
    const a = await prisma.supplier.create({ data: { name: "A", dpoEmail: "dpo@a.fr" } });
    const b = await prisma.supplier.create({ data: { name: "B" } });
    const s = contactsLus((await c.get(`/suppliers/${a.id}`)).text);
    expect(s).toContain("dpo@a.fr");
    expect(s).not.toContain("Contact commercial 2");
    expect((await c.get(`/suppliers/${b.id}`)).text).toContain(
      "Aucun contact n&#x27;est renseigné sur la fiche de « B »",
    );
  });

  it("l'onglet Contacts enregistre les contacts sans toucher au reste", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({
      data: { name: "Arpège", city: "Nantes", commercialContact: "DUPONT" },
    });
    // L'onglet porte l'assistance et les contacts : ce qu'il ne renvoie pas est effacé…
    await c.post(`/suppliers/${sup.id}/contacts`, {
      commercial2_contact: "MOREAU",
      dpo_email: "dpo@arpege.fr",
      customer_ref: "CLI-9",
    });
    let s = await prisma.supplier.findUniqueOrThrow({ where: { id: sup.id } });
    expect(s.commercialContact2).toBe("MOREAU");
    expect(s.dpoEmail).toBe("dpo@arpege.fr");
    expect(s.customerRef).toBe("CLI-9");
    expect(s.commercialContact).toBeNull();
    // … mais pas ce qui relève de Détails.
    expect(s.city).toBe("Nantes");
    // Et Détails, qui ne porte plus ces champs, ne les efface pas.
    await c.post(`/suppliers/${sup.id}/edit`, { name: "Arpège", city: "Rezé" });
    s = await prisma.supplier.findUniqueOrThrow({ where: { id: sup.id } });
    expect(s.city).toBe("Rezé");
    expect(s.commercialContact2).toBe("MOREAU");
    expect(s.customerRef).toBe("CLI-9");
  });

  it("le rail de la synthèse ne montre que ce qu'il a", async () => {
    const c = await clientAdmin();
    const seul = await prisma.supplier.create({ data: { name: "Seul" } });
    const editeur = await prisma.supplier.create({ data: { name: "Éditeur" } });
    await prisma.software.create({ data: { name: "Paie", supplierId: editeur.id } });
    await prisma.contract.create({ data: { name: "Maintenance Paie", supplierId: editeur.id } });
    let s = synthese((await c.get(`/suppliers/${seul.id}`)).text);
    expect(s).not.toContain("col-lg-3");
    expect(s).not.toContain("Chez nous");
    s = synthese((await c.get(`/suppliers/${editeur.id}`)).text);
    expect(s).toContain("Logiciels fournis");
    expect(s).toContain("Maintenance Paie");
    expect(s).not.toContain("Matériels fournis");
  });

  it("la carte certificats suit le fournisseur et le module", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({ data: { name: "Certinomis" } });
    const vide = await prisma.supplier.create({ data: { name: "Sans certificat" } });
    await prisma.certificate.createMany({
      data: [
        {
          kind: "tls",
          serviceName: "Portail",
          domain: "portail.fr",
          expiryDate: d(2030, 1, 1),
          supplierId: sup.id,
        },
        {
          kind: "signature",
          serviceName: "Mairie",
          holder: "DUPONT",
          expiryDate: d(2029, 1, 1),
          supplierId: sup.id,
        },
      ],
    });
    let html = (await c.get(`/suppliers/${sup.id}`)).text;
    expect(html).toContain("lucide-shield-check me-2");
    expect(html).toContain("Portail - portail.fr");
    expect(html).toContain("Mairie - DUPONT");
    expect((await c.get(`/suppliers/${vide.id}`)).text).not.toContain("lucide-shield-check me-2");
    await regler({ CERTIFICATES_ENABLED: false });
    html = (await c.get(`/suppliers/${sup.id}`)).text;
    expect(html).not.toContain("Portail - portail.fr");
    expect(html).not.toContain("Mairie - DUPONT");
    expect(html).not.toContain("lucide-shield-check me-2");
  });

  it("la carte contrats ne garde que ceux en cours", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({ data: { name: "Éditeur" } });
    await prisma.contract.createMany({
      data: [
        { name: "Acte échu", supplierId: sup.id, endDate: d(2020, 1, 1) },
        { name: "Acte courant", supplierId: sup.id, endDate: d(2099, 1, 1) },
      ],
    });
    const html = (await c.get(`/suppliers/${sup.id}`)).text;
    const s = synthese(html);
    expect(s).toContain("Acte courant");
    expect(s).not.toContain("Acte échu");
    const onglet = html.split('id="vol-contrats"', 2)[1];
    expect(onglet).toContain("Acte courant");
    expect(onglet).toContain("Acte échu");
  });

  it("les intitulés des contacts ne reprennent le rôle que sans nom", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({
      data: {
        name: "A",
        commercialContact: "DUPONT",
        commercialPhone: "0100000001",
        dpoEmail: "dpo@a.fr",
      },
    });
    // Le bloc est celui de l'onglet Contacts d'un logiciel : mêmes intitulés, « Non renseigné »
    // pour un champ vide, le second commercial seulement s'il existe.
    const s = contactsLus((await c.get(`/suppliers/${sup.id}`)).text);
    expect(s).toContain("Tél commercial");
    expect(s).toContain("01 00 00 00 01");
    expect(s).toContain("Mail DPO");
    expect(s).toContain("dpo@a.fr");
    expect(s).toContain("Non renseigné");
    expect(s).not.toContain("Contact commercial 2");
  });

  it("le second commercial n'apparaît que renseigné", async () => {
    const c = await clientAdmin();
    const seul = await prisma.supplier.create({
      data: { name: "Seul", commercialContact2: "MOREAU" },
    });
    const deux = await prisma.supplier.create({
      data: { name: "Deux", commercialContact: "DUPONT", commercialEmail2: "b@d.fr" },
    });
    const s = contactsLus((await c.get(`/suppliers/${seul.id}`)).text);
    expect(s).toContain("Contact commercial 2");
    expect(s).toContain("MOREAU");
    const dd = contactsLus((await c.get(`/suppliers/${deux.id}`)).text);
    expect(dd).toContain("DUPONT");
    expect(dd).toContain("Mail commercial 2");
    expect(dd).toContain("b@d.fr");
  });
});
