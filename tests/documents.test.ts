/** Pièces jointes : dépôt, téléchargement, aperçu, droits, module, rétention des sauvegardes (port de tests/test_documents.py). */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getSettings } from "@/server/config-store";
import { listBackups } from "@/server/db-backup";
import { permissionCategoryOf, viewable } from "@/server/documents";
import { ClientTest, clientAdmin } from "./setup/client";
import { creerUtilisateur, prisma, reglage, regler, resetDb } from "./setup/db";
import { baliseLien, entre } from "./setup/html";

beforeEach(resetDb);

const PDF = "%PDF-1.4 faux acte";
const fichier = (name: string, content: string | Buffer = PDF, type?: string) => ({
  file: { name, content, type },
});

async function deposer(
  c: ClientTest,
  kind: string,
  parentId: number,
  nom = "marche.pdf",
  contenu: string | Buffer = PDF,
  champs: Record<string, string> = {},
) {
  return c.post(
    "/documents/upload",
    { parent_kind: kind, parent_id: String(parentId), ...champs },
    { files: fichier(nom, contenu), followRedirects: true },
  );
}

const unDoc = () => prisma.document.findFirstOrThrow({ include: { content: true } });

describe("pièces jointes", () => {
  it("dépôt et téléchargement", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Marché UGAP" } });
    await deposer(c, "contract", ct.id, "marche-signe.pdf", "%PDF-1.4 acte signe");
    const doc = await unDoc();
    expect(doc.contractId).toBe(ct.id);
    expect(doc.filename).toBe("marche-signe.pdf");
    expect(doc.size).toBe(Buffer.byteLength("%PDF-1.4 acte signe"));
    expect(doc.uploadedBy).toBe("admin");
    expect(Buffer.from(doc.content?.data ?? []).toString()).toBe("%PDF-1.4 acte signe");
    const r = await c.get(`/documents/${doc.id}/download`);
    expect(r.status).toBe(200);
    expect(r.text).toBe("%PDF-1.4 acte signe");
    expect(r.mimetype).toBe("application/octet-stream");
    expect(r.headers.get("content-disposition")).toContain("attachment");
  });

  it("un HTML ne peut pas s'exécuter sur l'origine", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const r = await deposer(c, "software", sw.id, "piege.html", "<script>alert(1)</script>");
    expect(r.text).toContain("non accept");
    expect(await prisma.document.count()).toBe(0);
  });

  it("le nom de fichier est nettoyé", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    await deposer(c, "software", sw.id, "../../etc/passwd.pdf");
    const doc = await unDoc();
    expect(doc.filename).not.toContain("/");
    expect(doc.filename).not.toContain("\\");
    expect(doc.filename).not.toContain("..");
  });

  it("un fichier trop gros est refusé", async () => {
    const c = await clientAdmin();
    await regler({ DOCUMENT_MAX_MB: 1 });
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const r = await deposer(c, "software", sw.id, "gros.pdf", Buffer.alloc(2 * 1024 * 1024, "x"));
    expect(r.text).toContain("trop volumineux");
    expect(await prisma.document.count()).toBe(0);
  });

  it("un fichier vide est refusé", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const r = await deposer(c, "software", sw.id, "vide.pdf", "");
    expect(r.text).toContain("vide");
    expect(await prisma.document.count()).toBe(0);
  });

  it("la suppression emporte les octets", async () => {
    const c = await clientAdmin();
    const sup = await prisma.supplier.create({ data: { name: "Berger-Levrault" } });
    await deposer(c, "supplier", sup.id, "guide.pdf");
    const doc = await unDoc();
    await c.post(`/documents/${doc.id}/delete`, {}, { followRedirects: true });
    expect(await prisma.document.count()).toBe(0);
    expect(await prisma.documentContent.count()).toBe(0);
  });

  it("la pièce hérite de la catégorie de sa fiche", async () => {
    const base = {
      id: 0,
      softwareId: null,
      supplierId: null,
      contractId: null,
      quoteId: null,
      certificateId: null,
      equipmentId: null,
      categoryId: null,
      filename: "x",
      mime: null,
      size: null,
      docDate: null,
      uploadedBy: null,
      createdAt: new Date(),
    };
    expect(permissionCategoryOf({ ...base, softwareId: 1 })).toBe("software");
    expect(permissionCategoryOf({ ...base, contractId: 1 })).toBe("contracts");
    expect(permissionCategoryOf({ ...base, certificateId: 1 })).toBe("certificates");
    expect(permissionCategoryOf(base)).toBe("contracts");
  });

  it("un lecteur ne peut pas déposer", async () => {
    const sw = await prisma.software.create({ data: { name: "GED" } });
    await creerUtilisateur("lecteur", "Lecteur-2026!", "viewer");
    const lecteur = new ClientTest();
    await lecteur.login("lecteur", "Lecteur-2026!");
    const r = await deposer(lecteur, "software", sw.id);
    expect(r.text).toContain("pas les droits pour déposer");
    expect(await prisma.document.count()).toBe(0);
  });

  it("désactivé, le module ferme les routes", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    await deposer(c, "software", sw.id);
    const doc = await unDoc();
    await regler({ DOCUMENTS_ENABLED: false });
    expect((await c.get(`/documents/${doc.id}/download`)).status).toBe(404);
    expect(
      (
        await c.post(
          "/documents/upload",
          { parent_kind: "software", parent_id: String(sw.id) },
          { files: fichier("x.pdf") },
        )
      ).status,
    ).toBe(404);
    expect((await c.get(`/inventory/logiciels/${sw.id}`)).text).not.toContain("Pièces jointes");
    expect(await prisma.document.count()).toBe(1);
  });

  it("le réglage se change depuis les préférences", async () => {
    const c = await clientAdmin();
    await c.post(
      "/preferences",
      { action: "save_documents", documents_enabled: "on", document_max_mb: "25" },
      { followRedirects: true },
    );
    expect(await reglage("DOCUMENTS_ENABLED")).toBe(true);
    expect(await reglage("DOCUMENT_MAX_MB")).toBe(25);
    await c.post(
      "/preferences",
      { action: "save_documents", document_max_mb: "0" },
      { followRedirects: true },
    );
    expect(await reglage("DOCUMENTS_ENABLED")).toBe(false);
    expect(await reglage("DOCUMENT_MAX_MB")).toBe(1);
  });
});

describe("aperçu dans la page", () => {
  it("un PDF s'affiche sans être enregistré", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    await deposer(c, "software", sw.id, "marche.pdf", "%PDF-1.4 acte");
    const doc = await unDoc();
    const r = await c.get(`/documents/${doc.id}/view`);
    expect(r.status).toBe(200);
    expect(r.text).toBe("%PDF-1.4 acte");
    expect(r.mimetype).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toContain("inline");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("un SVG se télécharge mais ne s'affiche jamais", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    await deposer(c, "software", sw.id, "logo.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const doc = await unDoc();
    expect(viewable(await getSettings(), doc)).toBe(false);
    expect((await c.get(`/documents/${doc.id}/view`)).status).toBe(404);
    expect((await c.get(`/documents/${doc.id}/download`)).status).toBe(200);
  });

  it("un bureautique n'a pas d'aperçu", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    await deposer(c, "software", sw.id, "guide.docx", "PK fauxdocx");
    const doc = await unDoc();
    expect(viewable(await getSettings(), doc)).toBe(false);
    expect((await c.get(`/documents/${doc.id}/view`)).status).toBe(404);
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain("guide.docx");
    expect(html).not.toContain(`/documents/${doc.id}/view`);
    expect(html).toContain(`/documents/${doc.id}/download`);
  });

  it("une pièce lisible s'ouvre dans un onglet", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    await deposer(c, "software", sw.id, "acte.pdf", "%PDF-1.4 faux");
    const doc = await unDoc();
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    const lien = `/documents/${doc.id}/view`;
    expect(html).toContain(lien);
    const balise = baliseLien(html, lien);
    expect(balise).toContain('target="_blank"');
    expect(balise).toContain('rel="noopener"');
    const r = await c.get(lien);
    expect(r.status).toBe(200);
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("le type vient de l'extension, pas du déposant", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    await c.post(
      "/documents/upload",
      { parent_kind: "software", parent_id: String(sw.id) },
      { files: fichier("acte.pdf", "%PDF-1.4", "text/html"), followRedirects: true },
    );
    const doc = await unDoc();
    expect(doc.mime).toBe("text/html");
    expect((await c.get(`/documents/${doc.id}/view`)).mimetype).toBe("application/pdf");
  });

  it("l'aperçu se coupe depuis les préférences", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "GED" } });
    await deposer(c, "software", sw.id, "marche.pdf");
    const doc = await unDoc();
    expect((await c.get(`/documents/${doc.id}/view`)).status).toBe(200);
    await c.post(
      "/preferences",
      { action: "save_documents", documents_enabled: "on", document_max_mb: "10" },
      { followRedirects: true },
    );
    expect(await reglage("DOCUMENT_INLINE_VIEW")).toBe(false);
    expect((await c.get(`/documents/${doc.id}/view`)).status).toBe(404);
    expect((await c.get(`/documents/${doc.id}/download`)).status).toBe(200);
  });

  it("l'aperçu respecte les droits de la fiche", async () => {
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const doc = await prisma.document.create({
      data: {
        softwareId: sw.id,
        filename: "acte.pdf",
        size: 8,
        content: { create: { data: new Uint8Array(Buffer.from("%PDF-1.4")) } },
      },
    });
    await creerUtilisateur("aveugle", "Aveugle-2026!", "aveugle", { inventory: 0 });
    const c = new ClientTest();
    await c.login("aveugle", "Aveugle-2026!");
    expect((await c.get(`/documents/${doc.id}/view`)).status).toBe(403);
  });
});

describe("rétention des sauvegardes", () => {
  it("se règle depuis les préférences", async () => {
    const c = await clientAdmin();
    await c.post(
      "/preferences",
      { action: "save_backup_keep", backup_db_keep: "3" },
      { followRedirects: true },
    );
    expect(await reglage("BACKUP_DB_KEEP")).toBe(3);
  });

  it("est bornée des deux côtés", async () => {
    const c = await clientAdmin();
    for (const [saisi, attendu] of [
      ["0", 1],
      ["999", 30],
      ["", 14],
      ["beaucoup", 14],
    ] as [string, number][]) {
      await c.post(
        "/preferences",
        { action: "save_backup_keep", backup_db_keep: saisi },
        { followRedirects: true },
      );
      expect(await reglage("BACKUP_DB_KEEP"), saisi).toBe(attendu);
    }
  });

  it("la rotation applique le réglage", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sentinelle-bkp-"));
    try {
      for (let i = 0; i < 4; i++) {
        const chemin = path.join(dir, `sentinelle_2026010${i}_120000.dump`);
        await fs.writeFile(chemin, "x");
        await fs.utimes(chemin, 1000 + i, 1000 + i);
      }
      const cfg = { ...(await getSettings()), BACKUP_DB_DIR: dir, BACKUP_DB_KEEP: 2 };
      expect(await listBackups(cfg)).toHaveLength(4);
      const { rotate } = await import("@/server/db-backup");
      await rotate(cfg, dir);
      expect(await listBackups(cfg)).toHaveLength(2);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("pièces d'un logiciel et d'un marché", () => {
  it("l'onglet Documents d'un logiciel ne montre que ses pièces", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Concerto Opus" } });
    const ct = await prisma.contract.create({
      data: { name: "Marché M20-23", software: { create: { softwareId: sw.id } } },
    });
    const cons = await prisma.consultation.create({
      data: { softwareId: sw.id, subject: "Renouvellement 2027" },
    });
    const devis = await prisma.quote.create({
      data: { consultationId: cons.id, supplierName: "Arpege" },
    });
    await deposer(c, "contract", ct.id, "acte-signe.pdf");
    await deposer(c, "quote", devis.id, "devis-2027.pdf");
    await deposer(c, "software", sw.id, "guide.pdf");
    const page = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    const volet = entre(page, 'id="vol-documents"', 'id="vol-rgpd"');
    expect(volet).toContain("guide.pdf");
    expect(volet).not.toContain("acte-signe.pdf");
    expect(volet).not.toContain("devis-2027.pdf");
    expect(page).not.toContain("Pièces des marchés et des devis");
    expect(entre(page, 'id="vol-contrats"', 'id="vol-devis"')).toContain("acte-signe.pdf");
  });

  it("une pièce sans fichier attend son acte", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Marché RH" } });
    const piece = await prisma.document.create({
      data: { contractId: ct.id, filename: "Bon de commande 2019" },
    });
    expect(piece.size).toBeNull();
    expect((await c.get(`/documents/${piece.id}/download`)).status).toBe(404);
    expect((await c.get(`/documents/${piece.id}/view`)).status).toBe(404);
    const html = (await c.get(`/contracts/${ct.id}`)).text;
    expect(html).toContain("fichier à déposer");
    expect(html).toContain(`/documents/${piece.id}/file`);
    const r = await c.post(
      `/documents/${piece.id}/file`,
      {},
      { files: fichier("bc-2019.pdf"), followRedirects: true },
    );
    expect(r.status).toBe(200);
    const maj = await prisma.document.findUniqueOrThrow({ where: { id: piece.id } });
    expect(maj.size).toBeTruthy();
    expect(maj.filename).toBe("Bon de commande 2019");
    expect((await c.get(`/documents/${piece.id}/download`)).text).toBe(PDF);
    const r2 = await c.post(
      `/documents/${piece.id}/file`,
      {},
      { files: fichier("autre.pdf"), followRedirects: true },
    );
    expect(r2.text).toContain("déjà son fichier");
  });

  it("apporter un fichier demande le droit d'écriture", async () => {
    const ct = await prisma.contract.create({ data: { name: "Marché RH" } });
    const piece = await prisma.document.create({ data: { contractId: ct.id, filename: "BC" } });
    await creerUtilisateur("lecteur", "Lecteur-2026!", "viewer");
    const c = new ClientTest();
    await c.login("lecteur", "Lecteur-2026!");
    await c.post(`/documents/${piece.id}/file`, {}, { files: fichier("bc.pdf") });
    expect((await prisma.document.findUniqueOrThrow({ where: { id: piece.id } })).size).toBeNull();
  });

  it("modifier une pièce corrige ce qu'elle dit d'elle-même", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Marché RH" } });
    await deposer(c, "contract", ct.id, "acte.pdf");
    const doc = await unDoc();
    const cat = await prisma.referential.findFirstOrThrow({
      where: { kind: "doc_category", label: "Devis" },
    });
    await c.post(
      `/documents/${doc.id}/edit`,
      { category_id: String(cat.id), doc_date: "2026-03-01" },
      { followRedirects: true },
    );
    const maj = await prisma.document.findUniqueOrThrow({
      where: { id: doc.id },
      include: { content: true },
    });
    expect(maj.categoryId).toBe(cat.id);
    expect(maj.docDate?.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(Buffer.from(maj.content?.data ?? []).toString()).toBe(PDF);
  });

  it("le retour suit next mais jamais ailleurs", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Paie" } });
    const ct = await prisma.contract.create({
      data: { name: "Marché RH", software: { create: { softwareId: sw.id } } },
    });
    await deposer(c, "contract", ct.id, "acte.pdf");
    const doc = await unDoc();
    const r = await c.post(`/documents/${doc.id}/edit`, {
      next: `/inventory/logiciels/${sw.id}#contrats`,
    });
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.location ?? "").toMatch(new RegExp(`/inventory/logiciels/${sw.id}#contrats$`));
    const r2 = await c.post(`/documents/${doc.id}/delete`, { next: "https://ailleurs.example/" });
    expect(r2.location ?? "").toMatch(new RegExp(`/contracts/${ct.id}$`));
    expect(await prisma.document.count()).toBe(0);
  });

  it("la fiche logiciel propose crayon et corbeille", async () => {
    const c = await clientAdmin();
    const sw = await prisma.software.create({ data: { name: "Paie" } });
    const ct = await prisma.contract.create({
      data: { name: "Marché RH", software: { create: { softwareId: sw.id } } },
    });
    await deposer(c, "contract", ct.id, "acte.pdf");
    const doc = await unDoc();
    const html = (await c.get(`/inventory/logiciels/${sw.id}`)).text;
    expect(html).toContain(`/documents/${doc.id}/edit`);
    expect(html).toContain(`/documents/${doc.id}/delete`);
    expect(html).toContain("Supprimer la pièce et son fichier");
  });

  it("un lecteur ne modifie pas une pièce", async () => {
    const ct = await prisma.contract.create({ data: { name: "Marché RH" } });
    const doc = await prisma.document.create({
      data: { contractId: ct.id, filename: "acte.pdf", size: 3 },
    });
    await creerUtilisateur("lecteur", "Lecteur-2026!", "viewer");
    const c = new ClientTest();
    await c.login("lecteur", "Lecteur-2026!");
    await c.post(`/documents/${doc.id}/edit`, { doc_date: "2030-01-01" });
    expect((await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })).docDate).toBeNull();
  });

  it("renommer une pièce et remplacer son fichier", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Marché RH" } });
    await deposer(c, "contract", ct.id, "acte.pdf", "%PDF-1.4 v1");
    const doc = await unDoc();
    await c.post(
      `/documents/${doc.id}/edit`,
      { filename: "M19-14 Marché signé.pdf" },
      { followRedirects: true },
    );
    let maj = await prisma.document.findUniqueOrThrow({
      where: { id: doc.id },
      include: { content: true },
    });
    expect(maj.filename).toBe("M19-14 Marché signé.pdf");
    expect(Buffer.from(maj.content?.data ?? []).toString()).toBe("%PDF-1.4 v1");
    await c.post(
      `/documents/${doc.id}/edit`,
      { filename: "M19-14 Marché signé.pdf" },
      { files: fichier("nouveau.pdf", "%PDF-1.4 v2"), followRedirects: true },
    );
    maj = await prisma.document.findUniqueOrThrow({
      where: { id: doc.id },
      include: { content: true },
    });
    expect(maj.filename).toBe("M19-14 Marché signé.pdf");
    expect(Buffer.from(maj.content?.data ?? []).toString()).toBe("%PDF-1.4 v2");
    expect(maj.size).toBe(Buffer.byteLength("%PDF-1.4 v2"));
    expect(await prisma.documentContent.count()).toBe(1);
    await c.post(
      `/documents/${doc.id}/edit`,
      { filename: "" },
      { files: fichier("v3.pdf", "%PDF-1.4 v3"), followRedirects: true },
    );
    expect((await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })).filename).toBe(
      "v3.pdf",
    );
  });

  it("le nom d'une pièce n'est jamais un chemin", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Marché RH" } });
    await deposer(c, "contract", ct.id, "acte.pdf");
    const doc = await unDoc();
    await c.post(
      `/documents/${doc.id}/edit`,
      { filename: "../../etc/passwd" },
      { followRedirects: true },
    );
    const maj = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(maj.filename).not.toContain("/");
    expect(maj.filename).not.toContain("..");
    expect(maj.filename).toBe("etcpasswd");
  });

  it("un fichier refusé n'altère pas la pièce", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Marché RH" } });
    await deposer(c, "contract", ct.id, "acte.pdf", "%PDF-1.4 v1");
    const doc = await unDoc();
    const r = await c.post(
      `/documents/${doc.id}/edit`,
      { filename: "renomme.pdf" },
      { files: fichier("piege.html", "<script>"), followRedirects: true },
    );
    expect(r.text).toContain("non accept");
    const maj = await prisma.document.findUniqueOrThrow({
      where: { id: doc.id },
      include: { content: true },
    });
    expect(maj.filename).toBe("acte.pdf");
    expect(Buffer.from(maj.content?.data ?? []).toString()).toBe("%PDF-1.4 v1");
  });

  it("le nom se choisit dès le dépôt", async () => {
    const c = await clientAdmin();
    const ct = await prisma.contract.create({ data: { name: "Marché UGAP" } });
    await deposer(c, "contract", ct.id, "scan0001.pdf", PDF, { filename: "Acte signé 2026" });
    expect((await prisma.document.findFirstOrThrow()).filename).toBe("Acte signé 2026");
    await deposer(c, "contract", ct.id, "scan0002.pdf", PDF, { filename: "   " });
    expect((await prisma.document.findMany()).map((d) => d.filename).sort()).toEqual([
      "Acte signé 2026",
      "scan0002.pdf",
    ]);
  });
});
