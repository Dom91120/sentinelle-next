/** Import/export CSV : la colonne « equipment » relie par le nom (port de tests/test_csv.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { exportCsv, importCsv, templateCsv } from "@/server/csv-io";
import { jour, prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

describe("csv", () => {
  it("l'export d'un certificat écrit le nom de l'équipement", async () => {
    const e = await prisma.equipment.create({ data: { name: "SRV-WEB-01" } });
    await prisma.certificate.create({
      data: {
        serviceName: "Site",
        domain: "www.exemple.fr",
        expiryDate: jour(40),
        equipmentId: e.id,
      },
    });
    const texte = await exportCsv("certificates");
    expect(texte.split("\r\n")[0]).toContain("equipment");
    expect(texte).toContain("SRV-WEB-01");
  });

  it("l'import d'un certificat relie par le nom", async () => {
    await prisma.equipment.create({ data: { name: "SRV-SQL-01" } });
    const contenu =
      "service_name;domain;issuer;issued_at;expiry_date;auto_renew;priority;description;equipment\nBase SQL;sql.exemple.fr;Interne;;2026-12-01;non;high;;SRV-SQL-01\n";
    const [created, errors] = await importCsv("certificates", Buffer.from(contenu, "utf8"));
    expect(created).toBe(1);
    expect(errors).toEqual([]);
    const cert = await prisma.certificate.findFirst({
      where: { serviceName: "Base SQL" },
      include: { equipment: true },
    });
    expect(cert?.equipment?.name).toBe("SRV-SQL-01");
  });

  it("un équipement inconnu laisse le lien vide", async () => {
    const contenu =
      "service_name;domain;expiry_date;equipment\nSans lien;x.exemple.fr;2026-12-01;SERVEUR-FANTOME\n";
    const [created, errors] = await importCsv("certificates", Buffer.from(contenu, "utf8"));
    expect(created).toBe(1);
    expect(errors).toEqual([]);
    expect(
      (await prisma.certificate.findFirst({ where: { serviceName: "Sans lien" } }))?.equipmentId,
    ).toBeNull();
  });

  it("le modèle contient la colonne équipement", () => {
    for (const key of ["certificates", "backups", "updates"])
      expect(templateCsv(key).split("\r\n")[0], key).toContain("equipment");
  });

  it("l'export neutralise les formules", async () => {
    await prisma.account.create({ data: { serviceName: "=cmd|'/c calc'!A1", username: "x" } });
    const out = await exportCsv("accounts");
    expect(out).toContain("'=cmd");
    expect(out).not.toContain("\n=cmd");
  });
});
