/** Domaines : bureau d'enregistrement relié au fournisseur, dernier renouvellement et frise (port de test_domaines_registrar.py et test_domaines_frise.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { SUPPLIER_KIND_LABELS } from "@/lib/constantes";
import { fetchDomainInfo, refreshDomainRdap } from "@/modules/domains/server";
import { migrateData } from "@/server/amorcage";
import { clientAdmin } from "./setup/client";
import { prisma, resetDb } from "./setup/db";
import { optionSelectionnee } from "./setup/html";

beforeEach(resetDb);

const fournisseur = (name: string, kind?: string) =>
  prisma.supplier.create({ data: { name, kind } });
const d = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));

describe("bureau d'enregistrement", () => {
  it("l'annuaire connaît le bureau d'enregistrement", () => {
    expect(SUPPLIER_KIND_LABELS.registrar).toBe("Bureau d'enregistrement");
  });

  it("le texte du registrar trouve sa fiche par nom exact", async () => {
    const c = await clientAdmin();
    const ovh = await fournisseur("OVHcloud", "registrar");
    await c.post(
      "/domains/create",
      { name: "mairie.fr", registrar: "ovhcloud" },
      { followRedirects: true },
    );
    const dom = await prisma.domain.findFirstOrThrow();
    expect(dom.registrarId).toBe(ovh.id);
    expect(dom.registrar).toBe("ovhcloud");
    expect((await c.get(`/domains/${dom.id}`)).text).toContain(`/suppliers/${ovh.id}`);
    const html = (await c.get(`/suppliers/${ovh.id}`)).text;
    expect(html).toContain("ong-domaines");
    expect(html).toContain(`/domains/${dom.id}`);
  });

  it("un nom approchant ne suffit pas", async () => {
    const c = await clientAdmin();
    await fournisseur("OVHcloud");
    await c.post(
      "/domains/create",
      { name: "mairie.fr", registrar: "OVH" },
      { followRedirects: true },
    );
    const dom = await prisma.domain.findFirstOrThrow();
    expect(dom.registrarId).toBeNull();
    expect(dom.registrar).toBe("OVH");
    expect((await c.get(`/domains/${dom.id}`)).text).toContain("sans fiche fournisseur");
  });

  it("la fiche choisie prime et prête son nom", async () => {
    const c = await clientAdmin();
    const gandi = await fournisseur("Gandi");
    await c.post(
      "/domains/create",
      { name: "mairie.fr", registrar_id: String(gandi.id) },
      { followRedirects: true },
    );
    let dom = await prisma.domain.findFirstOrThrow();
    expect(dom.registrarId).toBe(gandi.id);
    expect(dom.registrar).toBe("Gandi");
    expect(optionSelectionnee((await c.get(`/domains/${dom.id}/edit`)).text, gandi.id)).toBe(true);
    await c.post(
      `/domains/${dom.id}/edit`,
      { name: "mairie.fr", registrar: "GANDI SAS", registrar_id: String(gandi.id) },
      { followRedirects: true },
    );
    dom = await prisma.domain.findUniqueOrThrow({ where: { id: dom.id } });
    expect(dom.registrarId).toBe(gandi.id);
    expect(dom.registrar).toBe("GANDI SAS");
    await c.post(
      `/domains/${dom.id}/edit`,
      { name: "mairie.fr", registrar: "Inconnu" },
      { followRedirects: true },
    );
    expect(
      (await prisma.domain.findUniqueOrThrow({ where: { id: dom.id } })).registrarId,
    ).toBeNull();
  });

  it("le formulaire propose l'ajout rapide d'un fournisseur", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/domains/create")).text;
    expect(html).toContain('name="registrar_id"');
    expect(html).toContain("qaModalSupplier");
  });

  it("la migration relie par nom sans homonyme", async () => {
    const ovh = await fournisseur("OVHcloud");
    await fournisseur("Gandi");
    await fournisseur("Gandi");
    await prisma.domain.createMany({
      data: [
        { name: "a.fr", registrar: "OVHcloud" },
        { name: "b.fr", registrar: "Gandi" },
        { name: "c.fr", registrar: "OVH" },
        { name: "d.fr" },
      ],
    });
    await migrateData();
    const [a, b, cc, dd] = await prisma.domain.findMany({ orderBy: { id: "asc" } });
    expect(a.registrarId).toBe(ovh.id);
    expect(b.registrarId).toBeNull();
    expect(cc.registrarId).toBeNull();
    expect(dd.registrarId).toBeNull();
  });

  it("la migration ne touche pas un lien déjà posé", async () => {
    const x = await fournisseur("Gandi");
    const y = await fournisseur("OVHcloud");
    const dom = await prisma.domain.create({
      data: { name: "a.fr", registrar: "OVHcloud", registrarId: x.id },
    });
    await migrateData();
    expect((await prisma.domain.findUniqueOrThrow({ where: { id: dom.id } })).registrarId).toBe(
      x.id,
    );
    expect(y.id).not.toBe(x.id);
  });
});

describe("dernier renouvellement (RDAP)", () => {
  const rdap = (events: Record<string, string>[]) =>
    (async () =>
      new Response(JSON.stringify({ events, entities: [] }), {
        status: 200,
      })) as unknown as typeof fetch;

  it("le RDAP donne le dernier renouvellement", async () => {
    const info = await fetchDomainInfo(
      "exemple.fr",
      5000,
      rdap([
        { eventAction: "registration", eventDate: "2015-03-01T10:00:00Z" },
        { eventAction: "last changed", eventDate: "2026-02-28T09:30:00Z" },
        { eventAction: "expiration", eventDate: "2027-03-01T00:00:00Z" },
      ]),
    );
    expect(info.expiryDate).toEqual(d(2027, 3, 1));
    expect(info.renewedOn).toEqual(d(2026, 2, 28));
  });

  it("sans dernier changement, l'enregistrement fait le début", async () => {
    const info = await fetchDomainInfo(
      "exemple.fr",
      5000,
      rdap([
        { eventAction: "registration", eventDate: "2015-03-01T10:00:00Z" },
        { eventAction: "expiration", eventDate: "2027-03-01T00:00:00Z" },
      ]),
    );
    expect(info.renewedOn).toEqual(d(2015, 3, 1));
  });

  it("un début après l'expiration ne compte pas", async () => {
    const info = await fetchDomainInfo(
      "exemple.fr",
      5000,
      rdap([
        { eventAction: "last changed", eventDate: "2027-06-01T00:00:00Z" },
        { eventAction: "expiration", eventDate: "2027-03-01T00:00:00Z" },
      ]),
    );
    expect(info.renewedOn).toBeNull();
  });

  it("vérifier au registre pose le renouvellement", async () => {
    const dom = await prisma.domain.create({
      data: { name: "registre.fr", expiryDate: d(2026, 1, 1) },
    });
    const [ok] = await refreshDomainRdap(dom, "admin", async () => ({
      expiryDate: d(2027, 1, 1),
      renewedOn: d(2026, 1, 1),
      registrar: "OVH",
    }));
    expect(ok).toBe(true);
    const maj = await prisma.domain.findUniqueOrThrow({ where: { id: dom.id } });
    expect(maj.renewedOn).toEqual(d(2026, 1, 1));
    expect(maj.expiryDate).toEqual(d(2027, 1, 1));
  });

  it("la frise du domaine part du dernier renouvellement", async () => {
    const c = await clientAdmin();
    const sans = await prisma.domain.create({
      data: { name: "sans.fr", expiryDate: d(2030, 1, 1) },
    });
    const avec = await prisma.domain.create({
      data: { name: "avec.fr", expiryDate: d(2030, 1, 1), renewedOn: d(2029, 1, 1) },
    });
    expect((await c.get(`/domains/${sans.id}`)).text).not.toContain("fiche-frise");
    const html = (await c.get(`/domains/${avec.id}`)).text;
    expect(html).toContain("fiche-frise");
    expect(html).toContain("01/01/2029");
  });

  it("le formulaire enregistre le renouvellement", async () => {
    const c = await clientAdmin();
    const dom = await prisma.domain.create({
      data: { name: "form.fr", expiryDate: d(2030, 1, 1) },
    });
    await c.post(
      `/domains/${dom.id}/edit`,
      { name: "form.fr", expiry_date: "2030-01-01", renewed_on: "2029-01-01" },
      { followRedirects: true },
    );
    expect((await prisma.domain.findUniqueOrThrow({ where: { id: dom.id } })).renewedOn).toEqual(
      d(2029, 1, 1),
    );
  });
});
