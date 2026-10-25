/** Certificats électroniques nominatifs : même table, mêmes alertes, même agenda que les TLS (port de tests/test_certificats_electroniques.py). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientTest, clientAdmin } from "./setup/client";
import { admin, creerUtilisateur, iso, jour, prisma, resetDb } from "./setup/db";
import { entre, optionSelectionnee } from "./setup/html";

vi.mock("@/server/alerts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/alerts")>();
  return { ...mod, sendAlert: vi.fn(async () => true) };
});

import {
  certificateHolderLabel,
  certificateLabel,
  certificateMonitored,
  certificateStatus,
  certificateSupportLabel,
  certificateUsageLabel,
  joursRestants,
} from "@/lib/statuts";
import { refreshCertificateTls } from "@/modules/certificates/server";
import { agendaItems } from "@/server/agenda";
import { sendAlert } from "@/server/alerts";
import { migrateCertificateLists, migrateReferentialScopes } from "@/server/amorcage";
import { exportCsv, importCsv } from "@/server/csv-io";
import { chargerTout } from "@/server/donnees";
import { loadUser } from "@/server/guards";
import { checkCertificates } from "@/server/taches";

const mock = vi.mocked(sendAlert);
beforeEach(async () => {
  await resetDb();
  mock.mockClear();
});

const ref = (kind: string, label: string) =>
  prisma.referential.findFirstOrThrow({ where: { kind, label } });
const certComplet = (id: number) =>
  prisma.certificate.findUniqueOrThrow({
    where: { id },
    include: { certUsage: true, support: true },
  });

describe("certificats électroniques", () => {
  it("création d'un certificat électronique", async () => {
    const c = await clientAdmin();
    const ca = await prisma.supplier.create({ data: { name: "Certinomis", kind: "ca" } });
    const sv = await prisma.userService.create({ data: { name: "État civil" } });
    await c.post(
      "/certificates/create",
      {
        kind: "signature",
        service_name: "Signature des marchés",
        civility: "mme",
        first_name: "Claire",
        holder: "ARNAUD",
        holder_role: "Adjointe",
        holder_email: "c.arnaud@ville.fr",
        supplier_id: String(ca.id),
        service_id: String(sv.id),
        usage_id: String((await ref("cert_usage", "Signature")).id),
        support_id: String((await ref("cert_support", "Carte à puce")).id),
        level: "RGS**",
        serial_number: "A1B2C3",
        duration_years: "3",
        amount_ttc: "120,50",
        budget_code: "60632",
        order_signed_on: "2026-01-15",
        revocation_code: "SECRET-42",
        expiry_date: iso(jour(400)),
        validity: "valide",
      },
      { followRedirects: true },
    );
    const cert = await prisma.certificate.findFirstOrThrow({
      where: { serviceName: "Signature des marchés" },
      include: { certUsage: true, support: true },
    });
    expect(cert.kind).toBe("signature");
    expect(cert.domain).toBeNull();
    expect(certificateHolderLabel(cert)).toBe("Mme ARNAUD Claire");
    expect(certificateLabel(cert)).toBe("Signature des marchés - Mme ARNAUD Claire");
    expect(cert.supplierId).toBe(ca.id);
    expect(cert.serviceId).toBe(sv.id);
    expect(certificateUsageLabel(cert)).toBe("Signature");
    expect(certificateSupportLabel(cert)).toBe("Carte à puce");
    expect(cert.durationYears).toBe(3);
    expect(Number(cert.amountTtc)).toBe(120.5);
    expect(cert.revocationCode).toBe("SECRET-42");
  });

  it("un certificat électronique n'exige pas de domaine, mais un titulaire", async () => {
    const c = await clientAdmin();
    let r = await c.post(
      "/certificates/create",
      { kind: "signature", service_name: "Parapheur", expiry_date: iso(jour(90)) },
      { followRedirects: true },
    );
    expect(r.text).toContain("titulaire est obligatoire");
    expect(await prisma.certificate.count()).toBe(0);
    r = await c.post(
      "/certificates/create",
      { kind: "tls", service_name: "Site", expiry_date: iso(jour(90)) },
      { followRedirects: true },
    );
    expect(r.text).toContain("domaine est obligatoire");
    expect(await prisma.certificate.count()).toBe(0);
  });

  it("le type se change dans le formulaire", async () => {
    const c = await clientAdmin();
    const cert = await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "Parapheur",
        holder: "ARNAUD",
        expiryDate: jour(200),
      },
    });
    const html = (await c.get(`/certificates/${cert.id}/edit`)).text;
    expect(html).toMatch(/<select[^>]*name="kind"/);
    expect(html).toContain('name="domain"');
    expect(html).toContain('name="holder"');
    await c.post(
      `/certificates/${cert.id}/edit`,
      {
        kind: "tls",
        service_name: "Parapheur",
        domain: "www.ville.fr",
        expiry_date: iso(jour(200)),
      },
      { followRedirects: true },
    );
    let maj = await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } });
    expect(maj.kind).toBe("tls");
    expect(maj.domain).toBe("www.ville.fr");
    await c.post(
      `/certificates/${cert.id}/edit`,
      { kind: "signature", holder: "ARNAUD", expiry_date: iso(jour(200)) },
      { followRedirects: true },
    );
    maj = await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } });
    expect(maj.kind).toBe("signature");
    expect(maj.domain).toBeNull();
    expect(maj.serviceName).toBe("Parapheur");
  });

  it("un certificat révoqué sort de la surveillance", async () => {
    const revoque = await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "A",
        holder: "X",
        expiryDate: jour(2),
        validity: "revoque",
      },
    });
    const suspendu = await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "B",
        holder: "Y",
        expiryDate: jour(2),
        validity: "suspendu",
      },
    });
    expect(certificateMonitored(revoque)).toBe(false);
    expect(certificateStatus(revoque)).toBe("success");
    expect(certificateMonitored(suspendu)).toBe(true);
    expect(certificateStatus(suspendu)).toBe("danger");
  });

  it("l'agenda ignore un certificat révoqué", async () => {
    await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "Révoqué",
        holder: "X",
        expiryDate: jour(10),
        validity: "revoque",
      },
    });
    await prisma.certificate.create({
      data: { kind: "signature", serviceName: "Vivant", holder: "Y", expiryDate: jour(10) },
    });
    const a = await loadUser((await admin()).id);
    if (!a) throw new Error("admin");
    const [, echeances] = await agendaItems(a);
    const noms = echeances.map((i) => i.name);
    expect(noms.some((n) => n.includes("Vivant"))).toBe(true);
    expect(noms.some((n) => n.includes("Révoqué"))).toBe(false);
  });

  it("la lecture TLS refuse un certificat sans domaine", async () => {
    const cert = await prisma.certificate.create({
      data: { kind: "signature", serviceName: "A", holder: "X", expiryDate: jour(100) },
    });
    const [ok, msg] = await refreshCertificateTls(cert, "test");
    expect(ok).toBe(false);
    expect(msg).toContain("n'a pas de domaine");
  });

  it("le code de révocation est rendu à qui peut modifier", async () => {
    const c = await clientAdmin();
    const cert = await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "Parapheur",
        holder: "ARNAUD",
        expiryDate: jour(300),
        revocationCode: "SECRET-42",
      },
    });
    expect((await c.get(`/certificates/${cert.id}`)).text).toContain("SECRET-42");
  });

  it("le code de révocation n'est pas rendu à un lecteur", async () => {
    const cert = await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "Parapheur",
        holder: "ARNAUD",
        expiryDate: jour(300),
        revocationCode: "SECRET-42",
      },
    });
    const v = await creerUtilisateur("lecteur", "Lecteur-2026!", "viewer");
    const viewer = await loadUser(v.id);
    expect(viewer?.canEdit("certificates")).toBe(false);
    const lecteur = new ClientTest();
    await lecteur.login("lecteur", "Lecteur-2026!");
    const html = (await lecteur.get(`/certificates/${cert.id}`)).text;
    expect(html).toContain("Parapheur");
    expect(html).not.toContain("SECRET-42");
  });

  it("un champ code vide n'efface pas le secret", async () => {
    const c = await clientAdmin();
    const cert = await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "Parapheur",
        holder: "ARNAUD",
        expiryDate: jour(300),
        revocationCode: "SECRET-42",
      },
    });
    const base = { service_name: "Parapheur", holder: "ARNAUD", expiry_date: iso(jour(300)) };
    await c.post(
      `/certificates/${cert.id}/edit`,
      { ...base, revocation_code: "" },
      { followRedirects: true },
    );
    expect(
      (await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } })).revocationCode,
    ).toBe("SECRET-42");
    await c.post(
      `/certificates/${cert.id}/edit`,
      { ...base, revocation_code: "-" },
      { followRedirects: true },
    );
    expect(
      (await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } })).revocationCode,
    ).toBeNull();
  });

  it("le code ne part pas dans l'export CSV", async () => {
    const c = await clientAdmin();
    await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "Parapheur",
        holder: "ARNAUD",
        expiryDate: jour(300),
        revocationCode: "SECRET-42",
      },
    });
    const csv = (await c.get("/data/certificates/export.csv")).text;
    expect(csv).toContain("ARNAUD");
    expect(csv).not.toContain("SECRET-42");
  });

  it("les onglets séparent les deux natures", async () => {
    const c = await clientAdmin();
    await prisma.certificate.createMany({
      data: [
        { kind: "tls", serviceName: "Site", domain: "www.ville.fr", expiryDate: jour(100) },
        { kind: "signature", serviceName: "Parapheur", holder: "ARNAUD", expiryDate: jour(100) },
      ],
    });
    let html = (await c.get("/certificates?kind=signature")).text;
    expect(html).toContain("ARNAUD");
    expect(html).not.toContain("www.ville.fr");
    html = (await c.get("/certificates?kind=tls")).text;
    expect(html).toContain("www.ville.fr");
    expect(html).not.toContain("ARNAUD");
  });

  it("le CSV transporte les deux natures", async () => {
    const contenu =
      "service_name;kind;domain;expiry_date;holder;civility;first_name;level\nSite;tls;www.ville.fr;2030-01-01;;;;\nParapheur;signature;;2030-06-30;ARNAUD;mme;Claire;RGS**\nAncien;;old.ville.fr;2030-03-01;;;;\n";
    const [created, errors] = await importCsv("certificates", Buffer.from(contenu, "utf8"));
    expect(created).toBe(3);
    expect(errors).toEqual([]);
    const sig = await prisma.certificate.findFirstOrThrow({ where: { serviceName: "Parapheur" } });
    expect(sig.kind).toBe("signature");
    expect(certificateHolderLabel(sig)).toBe("Mme ARNAUD Claire");
    expect(sig.level).toBe("RGS**");
    expect(
      (await prisma.certificate.findFirstOrThrow({ where: { serviceName: "Ancien" } })).kind,
    ).toBe("tls");
  });

  it("un certificat sans échéance est accepté", async () => {
    const c = await clientAdmin();
    const r = await c.post(
      "/certificates/create",
      { kind: "signature", service_name: "Site Ludo-Médiathèque", holder: "MACHINE" },
      { followRedirects: true },
    );
    expect(r.status).toBe(200);
    expect((await prisma.certificate.findFirstOrThrow()).expiryDate).toBeNull();
  });

  it("sans échéance, la fiche est orange et muette", async () => {
    const cert = await prisma.certificate.create({
      data: { kind: "signature", serviceName: "Parapheur", holder: "X" },
    });
    expect(certificateStatus(cert)).toBe("warning");
    expect(joursRestants(cert.expiryDate)).toBeNull();
    expect(certificateMonitored(cert)).toBe(false);
  });

  it("l'agenda et les urgences ignorent une échéance inconnue", async () => {
    const c = await clientAdmin();
    await prisma.certificate.createMany({
      data: [
        { kind: "signature", serviceName: "Sans date", holder: "X" },
        { kind: "signature", serviceName: "Avec date", holder: "Y", expiryDate: jour(10) },
      ],
    });
    const a = await loadUser((await admin()).id);
    if (!a) throw new Error("admin");
    const [, echeances] = await agendaItems(a);
    const noms = echeances.map((i) => i.name);
    expect(noms.some((n) => n.includes("Avec date"))).toBe(true);
    expect(noms.some((n) => n.includes("Sans date"))).toBe(false);
    expect((await c.get("/")).status).toBe(200);
  });

  it("le planificateur n'alerte pas sans date", async () => {
    await prisma.certificate.createMany({
      data: [
        { kind: "signature", serviceName: "Sans date", holder: "X" },
        { kind: "tls", serviceName: "Site", domain: "www.ville.fr", expiryDate: jour(1) },
      ],
    });
    await checkCertificates(await chargerTout());
    expect(mock.mock.calls.length).toBeGreaterThan(0);
    expect(mock.mock.calls.every((a) => !JSON.stringify(a).includes("Sans date"))).toBe(true);
  });

  it("la liste et la fiche disent à compléter", async () => {
    const c = await clientAdmin();
    const cert = await prisma.certificate.create({
      data: { kind: "signature", serviceName: "Parapheur", holder: "ARNAUD" },
    });
    expect((await c.get("/certificates")).text).toContain("compl");
    expect((await c.get(`/certificates/${cert.id}`)).text).toContain("compl");
  });

  it("le nom de la fiche se déduit du service ou du titulaire", async () => {
    const c = await clientAdmin();
    const elus = await prisma.userService.create({ data: { name: "Élus" } });
    const dsi = await prisma.userService.create({ data: { name: "DSI" } });
    await c.post("/certificates/create", {
      kind: "signature",
      holder: "ARNAUD",
      first_name: "Jean",
      service_id: String(elus.id),
    });
    const cert = await prisma.certificate.findFirstOrThrow({ where: { holder: "ARNAUD" } });
    expect(cert.serviceName).toBe("Élus");
    await c.post(`/certificates/${cert.id}/edit`, {
      holder: "ARNAUD",
      first_name: "Jean",
      service_id: String(dsi.id),
    });
    expect(
      (await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } })).serviceName,
    ).toBe("DSI");
    await c.post("/certificates/create", { kind: "signature", holder: "BRUN", first_name: "Anne" });
    expect(
      (await prisma.certificate.findFirstOrThrow({ where: { holder: "BRUN" } })).serviceName,
    ).toBe("BRUN Anne");
    const ancien = await prisma.certificate.create({
      data: { kind: "signature", serviceName: "Parapheur", holder: "CARON" },
    });
    await c.post(`/certificates/${ancien.id}/edit`, {
      holder: "CARON",
      service_id: String(dsi.id),
    });
    expect(
      (await prisma.certificate.findUniqueOrThrow({ where: { id: ancien.id } })).serviceName,
    ).toBe("Parapheur");
  });

  it("l'émetteur d'un certificat TLS se choisit dans l'annuaire", async () => {
    const c = await clientAdmin();
    const ca = await prisma.supplier.create({ data: { name: "Sectigo SA" } });
    const cert = await prisma.certificate.create({
      data: { kind: "tls", serviceName: "Portail", domain: "portail.fr", issuer: "Let's Encrypt" },
    });
    const html = (await c.get(`/certificates/${cert.id}/edit`)).text;
    expect(html).toMatch(/<select[^>]*name="supplier_id"/);
    expect(html).toMatch(
      /<input[^>]*type="hidden"[^>]*name="issuer"[^>]*value="Let&#x27;s Encrypt"|<input[^>]*name="issuer"[^>]*value="Let&#x27;s Encrypt"/,
    );
    expect((await c.get(`/certificates/${cert.id}`)).text).toContain("Let&#x27;s Encrypt");
    await c.post(`/certificates/${cert.id}/edit`, {
      service_name: "Portail",
      domain: "portail.fr",
      issuer: "Let's Encrypt",
      supplier_id: String(ca.id),
    });
    const maj = await prisma.certificate.findUniqueOrThrow({ where: { id: cert.id } });
    expect(maj.supplierId).toBe(ca.id);
    expect(maj.issuer).toBe("Let's Encrypt");
    const fiche = (await c.get(`/certificates/${cert.id}`)).text;
    expect(fiche).toContain(`/suppliers/${ca.id}`);
    expect(fiche).toContain("Sectigo SA");
  });

  it("l'équipement d'un certificat TLS se lit dans la rubrique Certificat", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({ data: { name: "SRV-WEB01", kind: "vm" } });
    const cert = await prisma.certificate.create({
      data: { kind: "tls", serviceName: "Portail", domain: "portail.fr", equipmentId: e.id },
    });
    const synthese = entre(
      (await c.get(`/certificates/${cert.id}`)).text,
      'id="vol-detail"',
      'id="vol-details"',
    );
    expect(synthese).not.toContain("Rattaché à");
    expect(synthese).toContain(`href="/inventory/${e.id}"`);
    expect(synthese).toContain("SRV-WEB01");
  });

  it("l'usage et le support sont des référentiels", async () => {
    const c = await clientAdmin();
    let html = (await c.get("/certificates/create")).text;
    for (const libelle of [
      "Serveur TLS / SSL",
      "Signature",
      "Authentification",
      "Cachet serveur",
      "Messagerie (S/MIME)",
      "Signature de code",
      "Horodatage",
      "Carte à puce",
      "Clé USB",
      "Fichier logiciel",
    ]) {
      expect(html, libelle).toContain(`>${libelle}</option>`);
    }
    const usage = await ref("cert_usage", "Serveur TLS / SSL");
    const support = await ref("cert_support", "Fichier logiciel");
    await c.post("/certificates/create", {
      kind: "tls",
      service_name: "Portail",
      domain: "portail.fr",
      usage_id: String(usage.id),
      support_id: String(support.id),
    });
    let cert = await prisma.certificate.findFirstOrThrow({
      where: { serviceName: "Portail" },
      include: { certUsage: true, support: true },
    });
    expect(cert.usageId).toBe(usage.id);
    expect(certificateUsageLabel(cert)).toBe("Serveur TLS / SSL");
    expect(cert.supportId).toBe(support.id);
    expect(certificateSupportLabel(cert)).toBe("Fichier logiciel");
    const fiche = (await c.get(`/certificates/${cert.id}`)).text;
    expect(fiche).toContain("Serveur TLS / SSL");
    expect(fiche).toContain("Fichier logiciel");
    await c.post("/referentiels/add", { kind: "cert_usage", label: "Chiffrement de disque" });
    html = (await c.get("/certificates/create")).text;
    expect(html).toContain(">Chiffrement de disque</option>");
    await c.post(`/certificates/${cert.id}/edit`, {
      kind: "tls",
      service_name: "Portail",
      domain: "portail.fr",
      usage_id: String(support.id),
      support_id: String(support.id),
    });
    cert = await certComplet(cert.id);
    expect(cert.usageId).toBeNull();
    expect(cert.supportId).toBe(support.id);
  });

  it("les anciens usages et supports sont repris", async () => {
    let cert = await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "Parapheur",
        holder: "ARNAUD",
        certUsageCode: "signature",
        supportCode: "cle_usb",
      },
      include: { certUsage: true, support: true },
    });
    expect(certificateUsageLabel(cert)).toBe("Signature");
    expect(certificateSupportLabel(cert)).toBe("Clé USB");
    await migrateCertificateLists();
    cert = await certComplet(cert.id);
    expect(cert.usageId).toBe((await ref("cert_usage", "Signature")).id);
    expect(cert.supportId).toBe((await ref("cert_support", "Clé USB")).id);
    const autre = await ref("cert_usage", "Autre");
    await prisma.certificate.update({ where: { id: cert.id }, data: { usageId: autre.id } });
    await migrateCertificateLists();
    expect((await certComplet(cert.id)).usageId).toBe(autre.id);
  });

  it("le CSV lit l'usage par libellé ou par ancienne clé", async () => {
    const contenu =
      "service_name;kind;domain;cert_usage;support\nPar libellé;tls;a.ville.fr;Serveur TLS / SSL;Fichier logiciel\nPar clé;tls;b.ville.fr;signature;cle_usb\nInconnu;tls;c.ville.fr;Télépathie;\n";
    const [created, errors] = await importCsv("certificates", Buffer.from(contenu, "utf8"));
    expect(created).toBe(3);
    expect(errors).toEqual([]);
    const parNom = Object.fromEntries(
      (await prisma.certificate.findMany({ include: { certUsage: true, support: true } })).map(
        (x) => [x.serviceName, x],
      ),
    );
    expect(certificateUsageLabel(parNom["Par libellé"])).toBe("Serveur TLS / SSL");
    expect(certificateSupportLabel(parNom["Par libellé"])).toBe("Fichier logiciel");
    expect(certificateUsageLabel(parNom["Par clé"])).toBe("Signature");
    expect(certificateSupportLabel(parNom["Par clé"])).toBe("Clé USB");
    expect(parNom.Inconnu.usageId).toBeNull();
    const exp = await exportCsv("certificates");
    expect(exp).toContain("Serveur TLS / SSL");
    expect(exp).toContain("Fichier logiciel");
  });

  it("un usage se réserve à un type de certificat", async () => {
    const c = await clientAdmin();
    expect((await ref("cert_usage", "Serveur TLS / SSL")).scope).toBe("tls");
    expect((await ref("cert_usage", "Signature")).scope).toBe("signature");
    expect((await ref("cert_usage", "Autre")).scope).toBe("tous");
    expect((await ref("cert_support", "Clé USB")).scope).toBeNull();
    const html = (await c.get("/certificates/create")).text;
    for (const p of ['data-portee="tls"', 'data-portee="signature"', 'data-portee="tous"'])
      expect(html).toContain(p);
    expect((await c.get("/preferences")).text).toContain('name="scope"');
    await c.post("/referentiels/add", { kind: "cert_usage", label: "Client VPN", scope: "tls" });
    const vpn = await ref("cert_usage", "Client VPN");
    expect(vpn.scope).toBe("tls");
    await c.post(`/referentiels/${vpn.id}/scope`, { scope: "tous" });
    expect((await ref("cert_usage", "Client VPN")).scope).toBe("tous");
    await c.post(`/referentiels/${vpn.id}/scope`, { scope: "n-importe-quoi" });
    expect((await ref("cert_usage", "Client VPN")).scope).toBe("tous");
    await c.post("/referentiels/add", { kind: "cert_support", label: "HSM", scope: "tls" });
    expect((await ref("cert_support", "HSM")).scope).toBeNull();
    const sig = await ref("cert_usage", "Signature");
    await prisma.referential.update({ where: { id: sig.id }, data: { scope: null } });
    const horodatage = await ref("cert_usage", "Horodatage");
    await prisma.referential.update({ where: { id: horodatage.id }, data: { scope: "tous" } });
    await migrateReferentialScopes();
    expect((await ref("cert_usage", "Signature")).scope).toBe("signature");
    expect((await ref("cert_usage", "Horodatage")).scope).toBe("tous");
  });

  it("l'option du type est sélectionnée dans le formulaire de modification", async () => {
    const c = await clientAdmin();
    const cert = await prisma.certificate.create({
      data: { kind: "signature", serviceName: "Parapheur", holder: "ARNAUD" },
    });
    expect(
      optionSelectionnee((await c.get(`/certificates/${cert.id}/edit`)).text, "signature"),
    ).toBe(true);
  });
});
