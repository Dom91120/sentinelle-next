/** Modules débrayables depuis Préférences : devis, RGPD, flux entre logiciels, certificats (port de tests/test_modules.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { collect } from "@/server/digest";
import { clientAdmin } from "./setup/client";
import { jour, prisma, reglage, regler, resetDb } from "./setup/db";

beforeEach(resetDb);

const logiciel = (data: Record<string, unknown> = {}) =>
  prisma.software.create({ data: { name: "GED", ...data } });

describe("modules", () => {
  it("les quatre modules se règlent depuis les préférences", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/preferences")).text;
    for (const name of ["quotes", "gdpr", "links", "certificates"])
      expect(html).toContain(`name="module_${name}"`);
    // Le badge de la rubrique Modules (le bandeau d'état en tête de page a disparu).
    expect(html).toContain("Tous actifs");
    await c.post("/preferences", { action: "save_modules" }, { followRedirects: true });
    for (const key of [
      "QUOTES_ENABLED",
      "GDPR_ENABLED",
      "SOFTWARE_LINKS_ENABLED",
      "CERTIFICATES_ENABLED",
    ])
      expect(await reglage(key), key).toBe(false);
    expect((await c.get("/preferences")).text).toContain("0/4 actifs");
    await c.post(
      "/preferences",
      { action: "save_modules", module_gdpr: "on" },
      { followRedirects: true },
    );
    expect(await reglage("GDPR_ENABLED")).toBe(true);
    expect(await reglage("QUOTES_ENABLED")).toBe(false);
  });

  it("devis coupés : plus d'onglet, ni de route, ni de recherche", async () => {
    const c = await clientAdmin();
    const sw = await logiciel();
    const cons = await prisma.consultation.create({
      data: { softwareId: sw.id, subject: "Renouvellement" },
    });
    const devis = await prisma.quote.create({
      data: { consultationId: cons.id, supplierName: "Docuware" },
    });
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).toContain("Devis");
    expect((await c.get("/search?q=docuware")).text).toContain("Docuware");

    await regler({ QUOTES_ENABLED: false });
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).not.toContain("ong-devis");
    expect(html).not.toContain("Renouvellement");
    expect((await c.get("/search?q=docuware")).text).not.toContain("Docuware");
    expect(
      (await c.post(`/contracts/consultations/${sw.id}/add`, { subject: "Autre" })).status,
    ).toBe(404);
    expect((await c.post(`/contracts/quotes/${devis.id}/delete`)).status).toBe(404);
    expect(await prisma.quote.count()).toBe(1);
  });

  it("RGPD coupé : le formulaire n'efface pas ce qui était saisi", async () => {
    const c = await clientAdmin();
    const sw = await logiciel({
      gdprPersonalData: true,
      gdprCategories: "état civil",
      gdprRegistryRef: "T-12",
      gdprLocation: "ue",
    });
    await regler({ GDPR_ENABLED: false });
    expect((await c.get(`/inventory/logiciels/${sw.id}/edit`)).text).not.toContain(
      "gdpr_personal_data",
    );
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).not.toContain("ong-rgpd");
    await c.post(
      `/inventory/logiciels/${sw.id}/edit`,
      { name: "GED", hosting: "saas" },
      { followRedirects: true },
    );
    let maj = await prisma.software.findUniqueOrThrow({ where: { id: sw.id } });
    expect(maj.gdprPersonalData).toBe(true);
    expect(maj.gdprCategories).toBe("état civil");
    expect(maj.gdprRegistryRef).toBe("T-12");
    expect(maj.gdprLocation).toBe("ue");
    await regler({ GDPR_ENABLED: true });
    await c.post(
      `/inventory/logiciels/${sw.id}/edit`,
      { name: "GED", hosting: "saas" },
      { followRedirects: true },
    );
    maj = await prisma.software.findUniqueOrThrow({ where: { id: sw.id } });
    expect(maj.gdprPersonalData).toBe(false);
  });

  it("flux coupés : plus de bloc ni de route", async () => {
    const c = await clientAdmin();
    const sw = await logiciel();
    const autre = await prisma.software.create({ data: { name: "Paie" } });
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).toContain("Interconnexions");
    await regler({ SOFTWARE_LINKS_ENABLED: false });
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).not.toContain("Interconnexions");
    expect(
      (await c.post(`/inventory/logiciels/${sw.id}/links/add`, { target_id: String(autre.id) }))
        .status,
    ).toBe(404);
  });

  it("certificats coupés : le module entier disparaît", async () => {
    const c = await clientAdmin();
    const tls = await prisma.certificate.create({
      data: { kind: "tls", serviceName: "Portail famille", domain: "famille.ville.fr" },
    });
    await prisma.certificate.create({
      data: { kind: "signature", serviceName: "Parapheur", holder: "Durand" },
    });
    const html = (await c.get("/certificates/create")).text;
    expect(html).toContain('value="tls"');
    expect(html).toContain('value="signature"');
    expect((await c.get("/")).text).toContain('href="/certificates"');
    expect((await c.get("/search?q=portail")).text).toContain("Portail famille");

    await regler({ CERTIFICATES_ENABLED: false });
    expect((await c.get("/")).text).not.toContain('href="/certificates"');
    expect((await c.get("/search?q=portail")).text).not.toContain("Portail famille");
    expect((await c.get("/certificates")).status).toBe(404);
    expect((await c.get(`/certificates/${tls.id}`)).status).toBe(404);
    expect((await c.get("/certificates/create?kind=signature")).status).toBe(404);
    expect(
      (
        await c.post("/certificates/create", {
          kind: "tls",
          service_name: "X",
          domain: "x.ville.fr",
        })
      ).status,
    ).toBe(404);
    expect(await prisma.certificate.findFirst({ where: { serviceName: "X" } })).toBeNull();
    expect(await prisma.certificate.count()).toBe(2);
    await regler({ CERTIFICATES_ENABLED: true });
    expect((await c.get("/certificates")).text).toContain("Durand");
  });

  it("certificats coupés : plus d'alerte ni de ligne au digest", async () => {
    await prisma.certificate.create({
      data: { kind: "tls", serviceName: "Expiré", domain: "x.ville.fr", expiryDate: jour(-3) },
    });
    expect((await collect()).some((d) => d.key === "Certificats")).toBe(true);
    await regler({ CERTIFICATES_ENABLED: false });
    expect((await collect()).some((d) => d.key === "Certificats")).toBe(false);
  });
});
