/** Fiche certificat, onglet Liaisons : les logiciels qui utilisent le certificat s'associent et se retirent. */
import { beforeEach, describe, expect, it } from "vitest";
import { clientAdmin } from "./setup/client";
import { jour, prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

const logicielsDe = async (certificateId: number) =>
  (
    await prisma.softwareCertificate.findMany({
      where: { certificateId },
      include: { software: true },
    })
  ).map((x) => x.software.name);

describe("certificats : liaisons", () => {
  it("les logiciels s'associent et se retirent depuis la fiche certificat", async () => {
    const c = await clientAdmin();
    const cert = await prisma.certificate.create({
      data: { serviceName: "Portail famille", domain: "famille.exemple.fr", expiryDate: jour(90) },
    });
    const sw = await prisma.software.create({ data: { name: "Portail" } });
    await prisma.software.create({ data: { name: "GED" } });

    let html = (await c.get(`/certificates/${cert.id}`)).text;
    expect(html).toContain("Liaisons");
    expect(html).toContain("Choisir un logiciel");
    expect(html).toContain(`<option value="${sw.id}">Portail</option>`);

    await c.post(
      `/certificates/${cert.id}/software`,
      { software_id: String(sw.id) },
      { followRedirects: true },
    );
    expect(await logicielsDe(cert.id)).toEqual(["Portail"]);
    html = (await c.get(`/certificates/${cert.id}`)).text;
    expect(html).toContain(`href="/inventory/logiciels/${sw.id}"`);
    expect(html.match(/<select[^>]*name="software_id"[\s\S]*?<\/select>/)?.[0] ?? "").not.toContain(
      `<option value="${sw.id}">`,
    );

    // Le lien est le même que celui de la fiche logiciel : il s'y voit aussi.
    const ficheLogiciel = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(ficheLogiciel).toContain(`href="/certificates/${cert.id}"`);

    // Associer deux fois ne crée pas de doublon.
    await c.post(
      `/certificates/${cert.id}/software`,
      { software_id: String(sw.id) },
      { followRedirects: true },
    );
    expect(await logicielsDe(cert.id)).toEqual(["Portail"]);

    await c.post(
      `/certificates/${cert.id}/software/${sw.id}/detach`,
      {},
      { followRedirects: true },
    );
    expect(await logicielsDe(cert.id)).toEqual([]);
    expect(await prisma.software.findUnique({ where: { id: sw.id } })).not.toBeNull();
  });

  it("le matériel s'associe, se remplace et se retire depuis la fiche certificat", async () => {
    const c = await clientAdmin();
    const cert = await prisma.certificate.create({
      data: { serviceName: "Intranet", domain: "intra.exemple.fr", expiryDate: jour(90) },
    });
    const e1 = await prisma.equipment.create({ data: { name: "SRV-WEB-01", kind: "vm" } });
    const e2 = await prisma.equipment.create({ data: { name: "SRV-WEB-02", kind: "vm" } });
    const lire = () => prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } });

    let html = (await c.get(`/certificates/${cert.id}`)).text;
    expect(html).toContain("Choisir un matériel");
    await c.post(
      `/certificates/${cert.id}/equipment`,
      { equipment_id: String(e1.id) },
      { followRedirects: true },
    );
    expect((await lire()).equipmentId).toBe(e1.id);
    html = (await c.get(`/certificates/${cert.id}`)).text;
    expect(html).toContain(`href="/inventory/${e1.id}"`);
    expect(html).toContain("Remplacer par");
    // Un seul matériel : associer un autre remplace le premier.
    await c.post(
      `/certificates/${cert.id}/equipment`,
      { equipment_id: String(e2.id) },
      { followRedirects: true },
    );
    expect((await lire()).equipmentId).toBe(e2.id);
    await c.post(`/certificates/${cert.id}/equipment/detach`, {}, { followRedirects: true });
    expect((await lire()).equipmentId).toBeNull();
    expect(await prisma.equipment.findUnique({ where: { id: e2.id } })).not.toBeNull();
  });
});
