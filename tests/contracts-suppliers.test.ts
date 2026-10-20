/** Contrats multi-équipements, ajout rapide, fiche fournisseur, contacts de l'éditeur (port de tests/test_contracts_suppliers.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { hasContacts } from "@/modules/suppliers/server";
import { clientAdmin } from "./setup/client";
import { prisma, resetDb } from "./setup/db";
import { entre } from "./setup/html";

beforeEach(resetDb);

const equipementsDe = async (id: number) =>
  (
    await prisma.contractEquipment.findMany({
      where: { contractId: id },
      include: { equipment: true },
    })
  ).map((x) => x.equipment.name);

describe("contrats et fournisseurs", () => {
  it("un contrat couvre plusieurs équipements", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({ data: { name: "Dell" } });
    const e1 = await prisma.equipment.create({ data: { name: "S1", kind: "vm" } });
    const e2 = await prisma.equipment.create({ data: { name: "S2", kind: "nas" } });
    const r = await c.post(
      "/contracts/create",
      {
        name: "Maint",
        kind: "maintenance",
        supplier_id: String(sup.id),
        equipment_ids: [String(e1.id), String(e2.id)],
        notice_days: "0",
      },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    const ct = await prisma.contract.findFirstOrThrow({ where: { name: "Maint" } });
    expect(new Set(await equipementsDe(ct.id))).toEqual(new Set(["S1", "S2"]));
  });

  it("la modification remplace les équipements", async () => {
    const c = await clientAdmin();
    const e1 = await prisma.equipment.create({ data: { name: "A", kind: "vm" } });
    const e2 = await prisma.equipment.create({ data: { name: "B", kind: "vm" } });
    await c.post(
      "/contracts/create",
      { name: "C", equipment_ids: [String(e1.id)] },
      { followRedirects: true },
    );
    const ct = await prisma.contract.findFirstOrThrow({ where: { name: "C" } });
    expect(await equipementsDe(ct.id)).toEqual(["A"]);
    await c.post(
      `/contracts/${ct.id}/edit`,
      { name: "C", equipment_ids: [String(e2.id)] },
      { followRedirects: true },
    );
    expect(await equipementsDe(ct.id)).toEqual(["B"]);
  });

  it("ajout rapide d'un fournisseur", async () => {
    const c = await clientAdmin();
    const r = await c.post("/suppliers/quick-create", { name: "HP", email: "a@b.fr" });
    expect(r.status).toBe(200);
    const j = r.json<{ ok: boolean; name: string; id: number }>();
    expect(j.ok).toBe(true);
    expect(j.name).toBe("HP");
    expect(Number.isInteger(j.id)).toBe(true);
    expect(await prisma.supplier.findFirst({ where: { name: "HP" } })).not.toBeNull();
    expect((await c.post("/suppliers/quick-create", { name: "" })).status).toBe(400);
  });

  it("ajout rapide d'un contrat", async () => {
    const c = await clientAdmin();
    const r = await c.post("/contracts/quick-create", {
      name: "Office 365",
      end_date: "2027-01-31",
    });
    expect(r.status).toBe(200);
    const j = r.json<{ ok: boolean; name: string; id: number }>();
    expect(j.ok && j.name === "Office 365" && Number.isInteger(j.id)).toBe(true);
    const ct = await prisma.contract.findFirstOrThrow({ where: { name: "Office 365" } });
    expect(ct.endDate?.toISOString().slice(0, 10)).toBe("2027-01-31");
    expect((await c.post("/contracts/quick-create", { name: "" })).status).toBe(400);
  });

  it("ajout rapide d'un équipement", async () => {
    const c = await clientAdmin();
    const r = await c.post("/inventory/quick-create", { name: "SRV-QA", kind: "physical" });
    expect(r.status).toBe(200);
    const j = r.json<{ ok: boolean; id: number; label: string }>();
    expect(j.ok && Boolean(j.id)).toBe(true);
    expect(j.label).toBe("SRV-QA (Serveur physique)");
    expect((await prisma.equipment.findFirstOrThrow({ where: { name: "SRV-QA" } })).kind).toBe(
      "physical",
    );
    const r2 = await c.post("/inventory/quick-create", { name: "SRV-X", kind: "bogus" });
    expect(r2.json<{ ok: boolean }>().ok).toBe(true);
    expect((await prisma.equipment.findFirstOrThrow({ where: { name: "SRV-X" } })).kind).toBe("vm");
    expect((await c.post("/inventory/quick-create", { name: "" })).status).toBe(400);
  });

  it("les formulaires affichent le bouton d'ajout rapide", async () => {
    const c = await clientAdmin();
    let html = (await c.get("/inventory/logiciels/create")).text;
    expect(html).toContain("qaModalSupplier");
    expect(html).not.toContain("qaModalContract");
    expect(html).not.toContain("qaModalEquipment");
    html = (await c.get("/contracts/create")).text;
    expect(html).toContain("qaModalSupplier");
    expect(html).not.toContain("qaModalEquipment");
    expect((await c.get("/inventory/create")).text).toContain("qaModalSupplier");
    expect((await c.get("/backups/create")).text).toContain("qaModalEquipment");
    html = (await c.get("/certificates/create")).text;
    expect(html).toContain('name="equipment_id"');
    expect(html).not.toContain("qaModalEquipment");
  });

  it("fiche fournisseur : impacts", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({ data: { name: "OVH" } });
    await prisma.equipment.create({
      data: { name: "SRVWEB", kind: "physical", supplierId: sup.id },
    });
    await prisma.contract.create({ data: { name: "Hebergement", supplierId: sup.id } });
    const html = (await c.get(`/suppliers/${sup.id}`)).text;
    expect(html).toContain("SRVWEB");
    expect(html).toContain("Hebergement");
    expect(html).toContain("Matériels fournis");
    expect(html).toContain("Contrats");
  });

  it("les contacts de l'éditeur sont enregistrés et hérités", async () => {
    const c = await clientAdmin();
    await c.post(
      "/suppliers/create",
      {
        name: "Berger-Levrault",
        kind: "editor",
        support_url: "https://support.bl.fr",
        support_phone: "0820000000",
        support_email: "assistance@bl.fr",
        customer_ref: "CLI-42",
        hours: "lundi au vendredi 8h-17h",
        hours2: "samedi 8h-12h",
        city: "Boulogne",
        website: "https://bl.fr",
        commercial_contact: "DUPONT",
        commercial_email: "dupont@bl.fr",
        commercial2_contact: "MOREAU",
        commercial2_phone: "0601020304",
        admin_contact: "Service facturation",
        admin_email: "factu@bl.fr",
        dpo_contact: "DPO BL",
        dpo_email: "dpo@bl.fr",
      },
      { followRedirects: true },
    );
    const sup = await prisma.supplier.findFirstOrThrow({ where: { name: "Berger-Levrault" } });
    expect(sup.supportEmail).toBe("assistance@bl.fr");
    expect(sup.hours2).toBe("samedi 8h-12h");
    expect(sup.commercialContact).toBe("DUPONT");
    expect(sup.commercialContact2).toBe("MOREAU");
    expect(sup.commercialPhone2).toBe("0601020304");
    expect(sup.adminEmail).toBe("factu@bl.fr");
    expect(sup.dpoEmail).toBe("dpo@bl.fr");
    expect(hasContacts(sup)).toBe(true);

    const sw = await prisma.software.create({
      data: { name: "e-Enfance", supplierId: sup.id, gdprPersonalData: true },
    });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    const synthese = entre(html, 'id="vol-detail"', 'id="vol-details"');
    expect(synthese).toContain("assistance@bl.fr");
    expect(synthese).toContain("dpo@bl.fr");
    expect(synthese).toContain("CLI-42");
    expect(synthese).not.toContain("MOREAU");
    expect(synthese).not.toContain("factu@bl.fr");
    const contacts = html.split('id="vol-contacts"', 2)[1];
    expect(contacts).toContain("MOREAU");
    expect(contacts).toContain("factu@bl.fr");
    expect(contacts).not.toContain('name="commercial_contact');
  });

  it("sans contact, la carte ne paraît pas", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({ data: { name: "Sans contact" } });
    expect(hasContacts(sup)).toBe(false);
    expect((await c.get(`/suppliers/${sup.id}`)).text).not.toContain("person-lines-fill");
  });

  it("le contrat porte imputation et bon de commande", async () => {
    const c = await clientAdmin();
    const r = await c.post(
      "/contracts/create",
      {
        name: "Cotisation ADULLACT",
        notice_days: "0",
        budget_code: "65818",
        order_signed_on: "2026-03-13",
      },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    const ct = await prisma.contract.findFirstOrThrow({ where: { name: "Cotisation ADULLACT" } });
    expect(ct.budgetCode).toBe("65818");
    expect(ct.orderSignedOn?.toISOString().slice(0, 10)).toBe("2026-03-13");
    expect(await prisma.contractSoftware.count({ where: { contractId: ct.id } })).toBe(0);
    const body = (await c.get(`/contracts/${ct.id}`)).text;
    expect(body).toContain("65818");
    expect(body).toContain("13/03/2026");
    const form = (await c.get(`/contracts/${ct.id}/edit`)).text;
    expect(form).not.toContain('name="service_id"');
    expect(form).not.toContain('name="responsible"');
    expect(form).not.toContain('name="priority"');
  });

  it("les deux champs se vident", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({
      data: { name: "Fibre", budgetCode: "6156", orderSignedOn: new Date(Date.UTC(2026, 0, 1)) },
    });
    await c.post(
      `/contracts/${ct.id}/edit`,
      { name: "Fibre", notice_days: "0", budget_code: "", order_signed_on: "" },
      { followRedirects: true },
    );
    const maj = await prisma.contract.findUniqueOrThrow({ where: { id: ct.id } });
    expect(maj.budgetCode).toBeNull();
    expect(maj.orderSignedOn).toBeNull();
  });
});
