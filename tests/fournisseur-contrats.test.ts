/** Fiche fournisseur, onglet Contrats : rattacher un contrat existant, en créer un déjà rattaché. */
import { beforeEach, describe, expect, it } from "vitest";
import { clientAdmin } from "./setup/client";
import { prisma, resetDb } from "./setup/db";
import { optionSelectionnee } from "./setup/html";

beforeEach(resetDb);

describe("fournisseur : contrats", () => {
  it("un contrat existant se rattache depuis la fiche fournisseur", async () => {
    const c = await clientAdmin();
    const f = await prisma.supplier.create({ data: { name: "Arpège" } });
    const autre = await prisma.supplier.create({ data: { name: "Berger-Levrault" } });
    const orphelin = await prisma.contract.create({ data: { name: "Marché sans fournisseur" } });
    const dAutre = await prisma.contract.create({
      data: { name: "Marché de l'autre", supplierId: autre.id },
    });
    const deja = await prisma.contract.create({
      data: { name: "Marché déjà là", supplierId: f.id },
    });

    // La liste propose les contrats des autres fournisseurs et les orphelins, pas les siens.
    let html = (await c.get(`/suppliers/${f.id}`)).text;
    expect(html).toContain("Rattacher un contrat existant");
    expect(html).toContain(`<option value="${orphelin.id}">`);
    expect(html).toContain(`<option value="${dAutre.id}">`);
    expect(html).not.toContain(`<option value="${deja.id}">`);
    expect(html).toContain(`href="/contracts/create?supplier_id=${f.id}"`);

    await c.post(
      `/contracts/supplier/${f.id}/attach`,
      { contract_id: String(orphelin.id) },
      { followRedirects: true },
    );
    expect(
      (await prisma.contract.findUniqueOrThrow({ where: { id: orphelin.id } })).supplierId,
    ).toBe(f.id);
    html = (await c.get(`/suppliers/${f.id}`)).text;
    expect(html).toContain(`href="/contracts/${orphelin.id}"`);
    expect(html).not.toContain(`<option value="${orphelin.id}">`);

    // Un contrat d'un autre fournisseur change de fournisseur.
    await c.post(
      `/contracts/supplier/${f.id}/attach`,
      { contract_id: String(dAutre.id) },
      { followRedirects: true },
    );
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: dAutre.id } })).supplierId).toBe(
      f.id,
    );
    // Sans choix : rien ne change.
    const r = await c.post(`/contracts/supplier/${f.id}/attach`, { contract_id: "" });
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toContain(`/suppliers/${f.id}`);
  });

  it("le formulaire de création présélectionne le fournisseur, et le contrat créé lui est rattaché", async () => {
    const c = await clientAdmin();
    const f = await prisma.supplier.create({ data: { name: "Arpège" } });
    const html = (await c.get(`/contracts/create?supplier_id=${f.id}`)).text;
    expect(optionSelectionnee(html, f.id)).toBe(true);

    const r = await c.post(`/contracts/create?supplier_id=${f.id}`, {
      name: "Maintenance Concerto",
      supplier_id: String(f.id),
    });
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toContain(`/suppliers/${f.id}`);
    const ct = await prisma.contract.findFirstOrThrow({ where: { name: "Maintenance Concerto" } });
    expect(ct.supplierId).toBe(f.id);
  });
});
