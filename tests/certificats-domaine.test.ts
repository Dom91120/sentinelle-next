/** Le certificat TLS est relié à la fiche du domaine enregistré dont relève son nom d'hôte (port de tests/test_certificats_domaine.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { domainForHost } from "@/lib/statuts";
import { migrateData } from "@/server/amorcage";
import { clientAdmin } from "./setup/client";
import { prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

const domaine = (name: string) => prisma.domain.create({ data: { name } });

describe("certificat et domaine", () => {
  it("pour un hôte, le domaine le plus long l'emporte", async () => {
    const court = await domaine("collectivite.fr");
    const long = await domaine("rh.collectivite.fr");
    await domaine("ville-collectivite.fr");
    const tous = await prisma.domain.findMany();
    expect(domainForHost("www.collectivite.fr", tous)?.id).toBe(court.id);
    expect(domainForHost("intra.rh.collectivite.fr", tous)?.id).toBe(long.id);
    expect(domainForHost("collectivite.fr", tous)?.id).toBe(court.id);
    expect(domainForHost("WWW.Collectivite.FR.", tous)?.id).toBe(court.id);
    expect(domainForHost("www.ville-collectivite.fr", tous)?.name).toBe("ville-collectivite.fr");
    expect(domainForHost("www.autre.fr", tous)).toBeNull();
    expect(domainForHost("", tous)).toBeNull();
  });

  it("un certificat créé depuis le formulaire est relié", async () => {
    const c = await clientAdmin();
    const d = await domaine("collectivite.fr");
    await c.post(
      "/certificates/create",
      { kind: "tls", service_name: "Site", domain: "www.collectivite.fr" },
      { followRedirects: true },
    );
    const cert = await prisma.certificate.findFirstOrThrow();
    expect(cert.domainId).toBe(d.id);
    expect(cert.domain).toBe("www.collectivite.fr");
    expect((await c.get(`/certificates/${cert.id}`)).text).toContain(`/domains/${d.id}`);
    const html = (await c.get(`/domains/${d.id}`)).text;
    expect(html).toContain("ong-certificats");
    expect(html).toContain(`/certificates/${cert.id}`);
  });

  it("un hôte hors référentiel reste sans lien", async () => {
    const c = await clientAdmin();
    await domaine("collectivite.fr");
    await c.post(
      "/certificates/create",
      { kind: "tls", service_name: "Extranet", domain: "extranet.prestataire.com" },
      { followRedirects: true },
    );
    const cert = await prisma.certificate.findFirstOrThrow();
    expect(cert.domainId).toBeNull();
    expect((await c.get(`/certificates/${cert.id}`)).text).toContain(
      "hors du référentiel des domaines",
    );
  });

  it("modifier l'hôte repose le lien", async () => {
    const c = await clientAdmin();
    const a = await domaine("collectivite.fr");
    const b = await domaine("collectivite92.com");
    const cert = await prisma.certificate.create({
      data: { kind: "tls", serviceName: "Site", domain: "www.collectivite.fr", domainId: a.id },
    });
    await c.post(
      `/certificates/${cert.id}/edit`,
      { kind: "tls", service_name: "Site", domain: "www.collectivite92.com" },
      { followRedirects: true },
    );
    expect((await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } })).domainId).toBe(
      b.id,
    );
  });

  it("un certificat électronique n'a pas de domaine", async () => {
    const c = await clientAdmin();
    await domaine("collectivite.fr");
    await c.post(
      "/certificates/create",
      { kind: "signature", service_name: "Elus", holder: "Durand" },
      { followRedirects: true },
    );
    expect((await prisma.certificate.findFirstOrThrow()).domainId).toBeNull();
  });

  it("créer le domaine après coup ramasse les certificats", async () => {
    const c = await clientAdmin();
    const cert = await prisma.certificate.create({
      data: { kind: "tls", serviceName: "Site", domain: "www.collectivite.fr" },
    });
    expect(cert.domainId).toBeNull();
    await c.post("/domains/create", { name: "collectivite.fr" }, { followRedirects: true });
    const d = await prisma.domain.findFirstOrThrow();
    expect((await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } })).domainId).toBe(
      d.id,
    );
  });

  it("la migration relie les certificats par nom d'hôte", async () => {
    const d = await domaine("collectivite.fr");
    await prisma.certificate.createMany({
      data: [
        {
          kind: "tls",
          serviceName: "Site",
          domain: "www.collectivite.fr",
          expiryDate: new Date(Date.UTC(2027, 0, 1)),
        },
        { kind: "tls", serviceName: "Extranet", domain: "extranet.prestataire.com" },
        { kind: "signature", serviceName: "Elus", holder: "Durand" },
      ],
    });
    await migrateData();
    const [site, extranet, elus] = await prisma.certificate.findMany({ orderBy: { id: "asc" } });
    expect(site.domainId).toBe(d.id);
    expect(extranet.domainId).toBeNull();
    expect(elus.domainId).toBeNull();
  });

  it("la migration ne touche pas un lien déjà posé", async () => {
    const a = await domaine("collectivite.fr");
    const b = await domaine("www.collectivite.fr");
    const cert = await prisma.certificate.create({
      data: { kind: "tls", serviceName: "Site", domain: "www.collectivite.fr", domainId: a.id },
    });
    await migrateData();
    expect((await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } })).domainId).toBe(
      a.id,
    );
    expect(b.id).not.toBe(a.id);
  });
});
