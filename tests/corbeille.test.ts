/** Corbeille : les équipements désactivés se restaurent et se purgent comme les autres (port de tests/test_corbeille.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { SPECS } from "@/server/corbeille";
import { clientAdmin } from "./setup/client";
import { jour, prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

const equipementSupprime = (name = "SRV-CORB-01") =>
  prisma.equipment.create({ data: { name, kind: "vm", isActive: false } });

describe("corbeille", () => {
  it("un équipement supprimé est visible dans la corbeille", async () => {
    const c = await clientAdmin();
    const e = await equipementSupprime();
    const r = await c.get("/trash");
    expect(r.status).toBe(200);
    expect(r.text).toContain("Matériel");
    expect(r.text).toContain(e.name);
  });

  it("restauration d'un équipement", async () => {
    const c = await clientAdmin();
    const e = await equipementSupprime();
    const r = await c.post(
      "/trash/restore",
      { entity_type: "equipment", entity_id: String(e.id) },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    expect(r.text).toContain("Élément restauré.");
    expect((await prisma.equipment.findUnique({ where: { id: e.id } }))?.isActive).toBe(true);
  });

  it("la purge détache les éléments liés", async () => {
    const c = await clientAdmin();
    const e = await equipementSupprime();
    const cert = await prisma.certificate.create({
      data: {
        serviceName: "Intranet",
        domain: "intra.exemple.fr",
        expiryDate: jour(90),
        equipmentId: e.id,
      },
    });
    const bkp = await prisma.backup.create({
      data: { serviceName: "Veeam SRV-CORB-01", frequency: "daily", equipmentId: e.id },
    });
    const upd = await prisma.systemUpdate.create({ data: { name: "GLPI", equipmentId: e.id } });
    const r = await c.post(
      "/trash/purge-one",
      { entity_type: "equipment", entity_id: String(e.id) },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    expect(await prisma.equipment.findUnique({ where: { id: e.id } })).toBeNull();
    expect(
      (await prisma.certificate.findUnique({ where: { id: cert.id } }))?.equipmentId,
    ).toBeNull();
    expect((await prisma.backup.findUnique({ where: { id: bkp.id } }))?.equipmentId).toBeNull();
    expect(
      (await prisma.systemUpdate.findUnique({ where: { id: upd.id } }))?.equipmentId,
    ).toBeNull();
  });

  it("la purge d'un logiciel emporte ses pièces jointes et celles de ses devis, pas celles des contrats", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Ludopret", isActive: false } });
    const consultation = await prisma.consultation.create({
      data: { softwareId: sw.id, subject: "Renouvellement" },
    });
    const devis = await prisma.quote.create({ data: { consultationId: consultation.id } });
    const contrat = await prisma.contract.create({
      data: { name: "Maintenance Ludopret", software: { create: { softwareId: sw.id } } },
    });
    const piece = (data: { softwareId?: number; quoteId?: number; contractId?: number }) =>
      prisma.document.create({
        data: { filename: "acte.pdf", mime: "application/pdf", size: 3, ...data },
      });
    const pieceLogiciel = await piece({ softwareId: sw.id });
    const pieceDevis = await piece({ quoteId: devis.id });
    const pieceContrat = await piece({ contractId: contrat.id });

    const r = await c.post(
      "/trash/purge-one",
      { entity_type: "software", entity_id: String(sw.id) },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    expect(await prisma.software.findUnique({ where: { id: sw.id } })).toBeNull();
    expect(await prisma.document.findUnique({ where: { id: pieceLogiciel.id } })).toBeNull();
    expect(await prisma.document.findUnique({ where: { id: pieceDevis.id } })).toBeNull();
    const restante = await prisma.document.findUnique({ where: { id: pieceContrat.id } });
    expect(restante?.contractId).toBe(contrat.id);
    expect(await prisma.contract.findUnique({ where: { id: contrat.id } })).not.toBeNull();
  });

  it("vider la corbeille inclut les équipements", async () => {
    const c = await clientAdmin();
    const e = await equipementSupprime();
    const r = await c.post("/trash/purge", {}, { followRedirects: true });
    expect(r.status).toBe(200);
    expect(await prisma.equipment.findUnique({ where: { id: e.id } })).toBeNull();
  });

  it("le badge de la corbeille couvre les mêmes catégories que la page", () => {
    const cats = new Set(Object.values(SPECS).map((s) => s.cat));
    for (const cat of [
      "accounts",
      "certificates",
      "domains",
      "backups",
      "tests",
      "reviews",
      "updates",
      "inventory",
    ])
      expect(cats, cat).toContain(cat);
  });
});
