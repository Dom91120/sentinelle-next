/** L'export total de secours : une archive sur DISQUE, jamais en mémoire (port de tests/test_export_complet.py). */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { buildFullExport } from "@/server/full-export";
import { ClientTest, clientAdmin } from "./setup/client";
import { creerUtilisateur, prisma, resetDb } from "./setup/db";
import { nomsDuZip } from "./setup/html";

beforeEach(resetDb);

/** `pg_dump` n'est pas toujours sur le PATH du poste de développement : sans lui, l'archive part sans la base. */
const pgDump =
  spawnSync(process.env.PG_DUMP_BIN?.split(/\s+/)[0] ?? "pg_dump", ["--version"], {
    windowsHide: true,
  }).status === 0;

async function archive(c: ClientTest, url = "/data/export-full.zip") {
  const r = await c.getBinaire(url);
  expect(r.status).toBe(200);
  return { r, noms: nomsDuZip(r.octets), buf: r.octets };
}

describe("export complet", () => {
  it("l'archive contient les CSV, la page et le LISEZMOI (et la base si pg_dump est là)", async () => {
    const c = await clientAdmin();
    const { r, noms } = await archive(c);
    if (pgDump) expect(noms).toContain("base/sentinelle.dump");
    expect(noms).toContain("consultation.html");
    expect(noms).toContain("LISEZMOI.txt");
    expect(noms.some((n) => n.startsWith("csv/"))).toBe(true);
    expect(r.headers.get("content-disposition")).toContain("attachment");
    expect(r.headers.get("content-disposition")).toContain(".zip");
  });

  it("l'export allégé laisse les fiches et retire les octets ; la base vivante n'est pas touchée", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const doc = await prisma.document.create({
      data: {
        softwareId: sw.id,
        filename: "acte.pdf",
        size: 18,
        content: { create: { data: new Uint8Array(Buffer.from("%PDF-1.4 acte signe")) } },
      },
    });
    const { noms } = await archive(c, "/data/export-full.zip?sans_documents=1");
    expect(noms).toContain("consultation.html");
    expect(await prisma.documentContent.count()).toBe(1);
    expect((await c.get(`/documents/${doc.id}/download`)).text).toBe("%PDF-1.4 acte signe");
  });

  it("la copie de travail ne reste pas à côté de l'archive", async () => {
    const [nom, chemin] = await buildFullExport();
    try {
      expect(nom).toMatch(/^sentinelle-export-\d{8}_\d{6}\.zip$/);
      await expect(fs.access(chemin)).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(path.dirname(chemin), "sentinelle.dump")),
      ).rejects.toBeTruthy();
    } finally {
      await fs.rm(path.dirname(chemin), { recursive: true, force: true });
    }
  });

  it("les restes abandonnés sont balayés", async () => {
    const racine = os.tmpdir();
    const vieux = path.join(racine, "sentinelle-export-abandonne-test");
    const recent = path.join(racine, "sentinelle-export-en-cours-test");
    await fs.mkdir(vieux, { recursive: true });
    await fs.mkdir(recent, { recursive: true });
    await fs.writeFile(path.join(vieux, "archive.zip"), "x");
    await fs.writeFile(path.join(recent, "archive.zip"), "x");
    const ancien = Date.now() / 1000 - 3600 - 60;
    await fs.utimes(vieux, ancien, ancien);
    try {
      const [, chemin] = await buildFullExport(); // déclenche le balayage
      await fs.rm(path.dirname(chemin), { recursive: true, force: true });
      await expect(fs.access(vieux)).rejects.toBeTruthy();
      await expect(fs.access(recent)).resolves.toBeUndefined();
    } finally {
      await fs.rm(vieux, { recursive: true, force: true });
      await fs.rm(recent, { recursive: true, force: true });
    }
  });

  it("réservé aux administrateurs", async () => {
    await creerUtilisateur("lecteur", "Lecteur-2026!", "viewer");
    const lecteur = new ClientTest();
    await lecteur.login("lecteur", "Lecteur-2026!");
    const r = await lecteur.get("/data/export-full.zip");
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.status).toBeLessThan(400);
  });
});
