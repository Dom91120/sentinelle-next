/**
 * API de chatIA (GET /api/chatia/...) : sa clé à lui, la lecture seule, et surtout ce qui
 * ne sort jamais — aucun secret, aucun texte libre (port de tests/test_api_chatia.py).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ClientTest, clientAdmin } from "./setup/client";
import { creerUtilisateur, iso, jour, prisma, reglage, regler, resetDb } from "./setup/db";
import { BASE_URL } from "./setup/env";

const CLE = "cle-chatia-de-test";
const ENTETE = { headers: { Authorization: `Bearer ${CLE}` } };
const ROUTES = [
  "/api/chatia/echeances",
  "/api/chatia/alertes",
  "/api/chatia/synthese",
  "/api/chatia/recherche?q=portail",
];

type Element = Record<string, unknown> & {
  nom: string;
  type: string;
  id: number;
  statut: string;
  echeance: string | null;
  details?: Record<string, unknown>;
};

beforeEach(async () => {
  await resetDb();
  await regler({ CHATIA_API_ENABLED: true, CHATIA_API_TOKEN: CLE });
});

async function lire<T = Record<string, unknown>>(chemin: string): Promise<T> {
  const r = await new ClientTest().get(chemin, ENTETE);
  expect(r.status, r.text).toBe(200);
  return r.json<T>();
}

/** Un échantillon de chaque famille, avec des secrets là où la base en a. */
async function peupler() {
  const sup = await prisma.supplier.create({ data: { name: "Certinomis", kind: "ca" } });
  await prisma.certificate.createMany({
    data: [
      {
        serviceName: "Portail",
        domain: "www.mairie.fr",
        expiryDate: jour(10),
        description: "mdp du keystore : Secret-Keystore-42",
      },
      {
        kind: "signature",
        serviceName: "Élus",
        holder: "EXEMPLE",
        firstName: "Anne",
        civility: "mme",
        expiryDate: jour(20),
        supplierId: sup.id,
        revocationCode: "REVOC-SECRET-9876",
      },
      { serviceName: "Ancien", domain: "old.mairie.fr", expiryDate: jour(5), validity: "revoque" },
      { serviceName: "Commande", domain: "new.mairie.fr" },
    ],
  });
  await prisma.domain.create({
    data: { name: "mairie.fr", expiryDate: jour(100), registrar: "Gandi" },
  });
  await prisma.account.create({
    data: {
      serviceName: "GLPI",
      username: "svc-admin",
      nextPasswordChange: jour(-3),
      description: "Mot de passe actuel : Hunter2-Secret",
    },
  });
  const sauvegarde = await prisma.backup.create({
    data: { serviceName: "Veeam serveurs", frequency: "daily" },
  });
  await prisma.testTask.create({
    data: { name: "PRA annuel", testType: "PRA", nextDue: jour(25) },
  });
  await prisma.accessReview.create({
    data: {
      application: "e.magnus",
      responsible: "Martine Dupuis",
      nextReview: jour(40),
      scope: "Comptes : voir le classeur protégé",
    },
  });
  await prisma.systemUpdate.createMany({
    data: [
      { name: "Zimbra", status: "critical", currentVersion: "9.0", latestVersion: "10.1" },
      { name: "Firefox", status: "up_to_date" },
    ],
  });
  await prisma.contract.create({
    data: { name: "Maintenance pare-feu", endDate: jour(70), noticeDays: 60 },
  });
  await prisma.equipment.create({
    data: { name: "SRV-AD01", kind: "physical", warrantyEnd: jour(15) },
  });
  await prisma.software.create({
    data: { name: "Ciril", lifecycle: "fin_de_vie", responsible: "Paul Martin" },
  });
  await prisma.backupCheck.create({
    data: { backupId: sauvegarde.id, checkDate: jour(0), status: "failed" },
  });
}

describe("accès", () => {
  it("désactivée : 503", async () => {
    await regler({ CHATIA_API_ENABLED: false });
    for (const chemin of ROUTES)
      expect((await new ClientTest().get(chemin, ENTETE)).status, chemin).toBe(503);
  });

  it("sans clé ou mauvaise clé : 401", async () => {
    const c = new ClientTest();
    for (const chemin of ROUTES) {
      expect((await c.get(chemin)).status, chemin).toBe(401);
      expect(
        (await c.get(chemin, { headers: { Authorization: "Bearer mauvaise" } })).status,
        chemin,
      ).toBe(401);
    }
  });

  it("clé absente : 503", async () => {
    await regler({ CHATIA_API_TOKEN: "" });
    expect(
      (
        await new ClientTest().get("/api/chatia/synthese", {
          headers: { Authorization: "Bearer x" },
        })
      ).status,
    ).toBe(503);
  });

  it("la clé de Sesame n'ouvre pas chatIA", async () => {
    await regler({ SESAME_API_ENABLED: true, SESAME_API_TOKEN: "cle-sesame" });
    const c = new ClientTest();
    expect(
      (await c.get("/api/chatia/synthese", { headers: { Authorization: "Bearer cle-sesame" } }))
        .status,
    ).toBe(401);
    expect((await c.get("/api/assets", ENTETE)).status).toBe(401);
  });

  it("lecture seule", async () => {
    const c = new ClientTest();
    for (const chemin of ROUTES) {
      const r = await fetch(`${BASE_URL}${chemin}`, { method: "POST", headers: ENTETE.headers });
      await r.arrayBuffer();
      expect(r.status, chemin).toBe(405);
    }
    expect(c).toBeTruthy();
  });

  it("réponses non mises en cache", async () => {
    const r = await new ClientTest().get("/api/chatia/synthese", ENTETE);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});

describe("échéances", () => {
  it("dans l'horizon et en retard", async () => {
    await peupler();
    const data = await lire<{
      dans: number;
      jusqu_au: string;
      elements: Element[];
      en_retard: number;
      total: number;
    }>("/api/chatia/echeances?dans=30");
    const noms = data.elements.map((e) => e.nom);
    expect(data.dans).toBe(30);
    expect(data.jusqu_au).toBe(iso(jour(30)));
    for (const n of [
      "Portail - www.mairie.fr",
      "Élus - Mme EXEMPLE Anne",
      "GLPI (svc-admin)",
      "PRA annuel",
      "SRV-AD01 (garantie)",
      "Maintenance pare-feu",
      "Veeam serveurs",
      "Zimbra",
      "Ciril",
    ]) {
      expect(noms, n).toContain(n);
    }
    for (const n of [
      "mairie.fr",
      "e.magnus",
      "Ancien - old.mairie.fr",
      "Commande - new.mairie.fr",
      "Firefox",
    ])
      expect(noms, n).not.toContain(n);
    expect(data.en_retard).toBe(1);
    expect(data.total).toBe(noms.length);
  });

  it("le préavis d'un contrat fait son échéance", async () => {
    await prisma.contract.create({ data: { name: "Licences", endDate: jour(50), noticeDays: 30 } });
    const data = await lire<{ elements: Element[] }>("/api/chatia/echeances?dans=30");
    const contrat = data.elements.find((e) => e.nom === "Licences");
    expect(contrat?.echeance).toBe(iso(jour(20)));
    expect(contrat?.jours_restants).toBe(20);
    expect(String(contrat?.detail)).toContain("préavis 30 j");
  });

  it("forme d'un élément", async () => {
    await peupler();
    const data = await lire<{ elements: Element[] }>("/api/chatia/echeances?type=certificat");
    const portail = data.elements.find((e) => e.nom === "Portail - www.mairie.fr");
    if (!portail) throw new Error("Portail absent");
    for (const k of [
      "type",
      "type_libelle",
      "id",
      "nom",
      "objet",
      "echeance",
      "jours_restants",
      "en_retard",
      "detail",
      "statut",
      "statut_libelle",
      "responsable",
      "reporte_jusqu_au",
      "lien",
    ])
      expect(portail, k).toHaveProperty(k);
    expect(portail.type).toBe("certificat");
    expect(portail.type_libelle).toBe("Certificat TLS");
    expect(portail.jours_restants).toBe(10);
    expect(portail.en_retard).toBe(false);
    expect(portail.statut).toBe("warning");
    expect(portail.statut_libelle).toBe("Urgent");
    expect(portail.detail).toBe("Certificat expire dans 10 j");
    expect(portail.lien).toBe(`${BASE_URL}/certificates/${portail.id}`);
    const elus = data.elements.find((e) => e.type_libelle === "Certificat électronique");
    expect(elus?.titulaire).toBe("Mme EXEMPLE Anne");
  });

  it("retard et responsable", async () => {
    await peupler();
    const data = await lire<{ elements: Element[] }>(
      "/api/chatia/echeances?dans=60&type=mot_de_passe,revue",
    );
    expect(new Set(data.elements.map((e) => e.type))).toEqual(new Set(["mot_de_passe", "revue"]));
    const compte = data.elements.find((e) => e.type === "mot_de_passe");
    expect(compte?.en_retard).toBe(true);
    expect(compte?.jours_restants).toBe(-3);
    expect(compte?.detail).toBe("Mot de passe à renouveler en retard de 3 j");
    expect(data.elements.find((e) => e.type === "revue")?.responsable).toBe("Martine Dupuis");
  });

  it("types répétés ou séparés par des virgules", async () => {
    await peupler();
    const a = await lire<{ elements: Element[]; types: string[] }>(
      "/api/chatia/echeances?type=sauvegarde&type=mise_a_jour",
    );
    const b = await lire<{ elements: Element[] }>(
      "/api/chatia/echeances?type=sauvegarde,mise_a_jour",
    );
    expect(a.elements).toEqual(b.elements);
    expect(a.types).toEqual(["sauvegarde", "mise_a_jour"]);
    expect(new Set(a.elements.map((e) => e.nom))).toEqual(new Set(["Veeam serveurs", "Zimbra"]));
    const zimbra = a.elements.find((e) => e.nom === "Zimbra");
    expect(zimbra?.echeance).toBeNull();
    expect(zimbra?.detail).toBe("Mise à jour critique (9.0 → 10.1)");
  });

  it("report signalé", async () => {
    await peupler();
    const portail = await prisma.certificate.findFirstOrThrow({
      where: { serviceName: "Portail" },
    });
    await prisma.alertSnooze.create({
      data: { entityType: "certificate", entityId: portail.id, snoozedUntil: jour(7) },
    });
    const data = await lire<{ elements: Element[] }>("/api/chatia/echeances?type=certificat");
    expect(data.elements.find((e) => e.id === portail.id)?.reporte_jusqu_au).toBe(iso(jour(7)));
  });

  it("paramètres invalides : 400", async () => {
    for (const requete of ["dans=-1", "dans=abc", "dans=9999", "type=imprimante"]) {
      const r = await new ClientTest().get(`/api/chatia/echeances?${requete}`, ENTETE);
      expect(r.status, requete).toBe(400);
      expect(r.json<{ error: string }>().error).toBeTruthy();
    }
  });

  it("module certificats coupé", async () => {
    await peupler();
    await regler({ CERTIFICATES_ENABLED: false });
    const data = await lire<{ types: string[]; elements: Element[] }>("/api/chatia/echeances");
    expect(data.types).not.toContain("certificat");
    expect(data.elements.every((e) => e.type !== "certificat")).toBe(true);
    const synthese = await lire<{ categories: { type: string }[] }>("/api/chatia/synthese");
    expect(synthese.categories.every((c) => c.type !== "certificat")).toBe(true);
  });
});

describe("synthèse", () => {
  it("par type et statut", async () => {
    await peupler();
    await prisma.alertLog.create({
      data: {
        alertType: "email",
        entityType: "certificate",
        entityId: 1,
        entityName: "Portail - www.mairie.fr",
        status: "sent",
        message: "corps du mail",
        recipients: "dsi@ville.fr",
      },
    });
    await prisma.alertLog.create({
      data: {
        alertType: "email",
        entityType: "account",
        entityId: 1,
        entityName: "GLPI (svc-admin)",
        status: "failed",
        message: "ERREUR: SMTP 535 mot de passe refusé",
        recipients: "dsi@ville.fr",
      },
    });
    type Synthese = {
      categories: { type: string; total: number; par_statut: Record<string, number> }[];
      totaux: { total: number };
      conformite: number;
      alertes: Record<string, number> & { dernieres: Record<string, unknown>[] };
      lien: string;
    };
    const data = await lire<Synthese>("/api/chatia/synthese");
    const parType = Object.fromEntries(data.categories.map((c) => [c.type, c]));
    expect(parType.certificat.total).toBe(4);
    expect(parType.mise_a_jour.par_statut).toEqual({ danger: 1, warning: 0, info: 0, success: 1 });
    expect(data.totaux.total).toBe(data.categories.reduce((a, c) => a + c.total, 0));
    expect(data.conformite).toBeGreaterThanOrEqual(0);
    expect(data.conformite).toBeLessThanOrEqual(100);
    const alertes = data.alertes;
    expect(alertes.critiques).toBeGreaterThanOrEqual(3);
    expect(alertes.ouvertes).toBe(alertes.critiques + alertes.urgentes);
    expect(alertes.envoyees_7_jours).toBe(1);
    expect(alertes.echecs_7_jours).toBe(1);
    expect(["certificat", "mot_de_passe"]).toContain(alertes.dernieres[0].type);
    expect(new Set(Object.keys(alertes.dernieres[0]))).toEqual(
      new Set(["date", "type", "nom", "envoyee"]),
    );
    expect(data.lien).toBe(`${BASE_URL}/`);
  });

  it("une alerte reportée n'est plus ouverte", async () => {
    const u = await prisma.systemUpdate.create({ data: { name: "Zimbra", status: "critical" } });
    const avant = (await lire<{ alertes: Record<string, number> }>("/api/chatia/synthese")).alertes;
    await prisma.alertSnooze.create({
      data: { entityType: "update", entityId: u.id, snoozedUntil: jour(7) },
    });
    const apres = (await lire<{ alertes: Record<string, number> }>("/api/chatia/synthese")).alertes;
    expect(avant.critiques).toBe(1);
    expect(apres.critiques).toBe(0);
    expect(apres.reportees).toBe(1);
  });
});

describe("alertes", () => {
  it("détaillent les comptes de la synthèse", async () => {
    await peupler();
    const resume = (
      await lire<{
        alertes: {
          ouvertes: number;
          critiques: number;
          urgentes: number;
          par_type: Record<string, { critiques: number; urgents: number }>;
        };
      }>("/api/chatia/synthese")
    ).alertes;
    const data = await lire<{
      total: number;
      critiques: number;
      urgentes: number;
      elements: Element[];
      reportees_incluses: boolean;
      tronque: boolean;
    }>("/api/chatia/alertes");
    expect([data.total, data.critiques, data.urgentes]).toEqual([
      resume.ouvertes,
      resume.critiques,
      resume.urgentes,
    ]);
    const parType: Record<string, { critiques: number; urgents: number }> = {};
    for (const e of data.elements) {
      parType[e.type] ??= { critiques: 0, urgents: 0 };
      const c = parType[e.type];
      if (e.statut === "danger") c.critiques += 1;
      else c.urgents += 1;
    }
    expect(parType).toEqual(resume.par_type);
    const noms = data.elements.map((e) => e.nom);
    for (const n of ["GLPI (svc-admin)", "Veeam serveurs", "Zimbra"]) expect(noms).toContain(n);
    expect(noms).not.toContain("Firefox");
    expect(noms).not.toContain("mairie.fr");
    const statuts = data.elements.map((e) => e.statut);
    expect(statuts).toEqual(
      [...statuts].sort(
        (a, b) => ["danger", "warning"].indexOf(a) - ["danger", "warning"].indexOf(b),
      ),
    );
    expect(data.reportees_incluses).toBe(false);
    expect(data.tronque).toBe(false);
  });

  it("matériel par fiche et filtre par type", async () => {
    await peupler();
    const materiel = (await lire<{ elements: Element[] }>("/api/chatia/alertes?type=materiel"))
      .elements;
    expect(materiel.every((e) => e.type === "materiel")).toBe(true);
    expect(materiel.every((e) => !e.nom.includes("(garantie)"))).toBe(true);
    expect((await lire<{ total: number }>("/api/chatia/alertes?type=domaine")).total).toBe(0);
  });

  it("reportées à la demande", async () => {
    const u = await prisma.systemUpdate.create({ data: { name: "Zimbra", status: "critical" } });
    await prisma.alertSnooze.create({
      data: { entityType: "update", entityId: u.id, snoozedUntil: jour(7) },
    });
    expect((await lire<{ total: number }>("/api/chatia/alertes")).total).toBe(0);
    const data = await lire<{ total: number; reportees_incluses: boolean; elements: Element[] }>(
      "/api/chatia/alertes?reportees=1",
    );
    expect(data.total).toBe(1);
    expect(data.reportees_incluses).toBe(true);
    expect(data.elements[0].reporte_jusqu_au).toBe(iso(jour(7)));
  });
});

describe("recherche", () => {
  it("sans accent ni majuscule", async () => {
    await peupler();
    const data = await lire<{ total: number; elements: Element[] }>("/api/chatia/recherche?q=elus");
    expect(data.total).toBe(1);
    expect(data.elements[0].nom).toBe("Élus - Mme EXEMPLE Anne");
    expect(data.elements[0].details?.autorite).toBe("Certinomis");
    expect((await lire<{ total: number }>("/api/chatia/recherche?q=EXEMPLE")).total).toBe(1);
  });

  it("par responsable et détails", async () => {
    await peupler();
    const data = await lire<{ elements: Element[] }>("/api/chatia/recherche?q=dupuis");
    expect(data.elements.map((e) => e.nom)).toEqual(["e.magnus"]);
    expect(data.elements[0].details?.frequence_jours).toBe(365);
    const srv = (await lire<{ elements: Element[] }>("/api/chatia/recherche?q=srv-ad")).elements[0];
    expect(srv.type).toBe("materiel");
    expect(srv.details?.fin_garantie).toBe(iso(jour(15)));
  });

  it("ne lit pas les textes libres", async () => {
    await peupler();
    expect((await lire<{ total: number }>("/api/chatia/recherche?q=keystore")).total).toBe(0);
    expect((await lire<{ total: number }>("/api/chatia/recherche?q=hunter2")).total).toBe(0);
  });

  it("trop courte ou trop longue : 400", async () => {
    for (const q of ["", "a", "x".repeat(101)])
      expect((await new ClientTest().get(`/api/chatia/recherche?q=${q}`, ENTETE)).status, q).toBe(
        400,
      );
  });
});

describe("jamais de secret", () => {
  it("aucun secret dans aucune réponse", async () => {
    await peupler();
    await regler({ MAIL_PASSWORD: "Mot-De-Passe-SMTP" });
    await prisma.alertLog.create({
      data: {
        alertType: "email",
        entityType: "account",
        entityId: 1,
        entityName: "GLPI (svc-admin)",
        status: "failed",
        message: "ERREUR: SMTP Mot-De-Passe-SMTP",
        recipients: "dsi@ville.fr",
      },
    });
    let corps = "";
    for (const chemin of [
      "/api/chatia/echeances?dans=730",
      "/api/chatia/alertes?reportees=1",
      "/api/chatia/synthese",
      "/api/chatia/recherche?q=portail",
      "/api/chatia/recherche?q=elus",
      "/api/chatia/recherche?q=glpi",
      "/api/chatia/recherche?q=e.magnus",
    ]) {
      corps += JSON.stringify(await lire(chemin));
    }
    for (const secret of [
      "REVOC-SECRET-9876",
      "Secret-Keystore-42",
      "Hunter2-Secret",
      "classeur protégé",
      "Mot-De-Passe-SMTP",
      "dsi@ville.fr",
      CLE,
      "revocation",
      "description",
    ]) {
      expect(corps, secret).not.toContain(secret);
    }
  });
});

describe("page Connecteurs", () => {
  it("annonce chatIA", async () => {
    const c = await clientAdmin();
    const body = (await c.get("/connecteurs")).text;
    expect(body).toContain("chatIA");
    expect(body).toContain("chatia_enabled");
    expect(body).toContain("/api/chatia/");
    expect(body).toContain("Sesame");
  });

  it("activation et clé chatIA", async () => {
    const c = await clientAdmin();
    await regler({ CHATIA_API_ENABLED: false, SESAME_API_TOKEN: "cle-sesame-inchangee" });
    await c.post("/connecteurs/chatia", { action: "save", chatia_enabled: "on" });
    expect(await reglage("CHATIA_API_ENABLED")).toBe(true);
    const r = await c.post(
      "/connecteurs/chatia",
      { action: "generate_key" },
      { followRedirects: true },
    );
    const cle = await reglage<string>("CHATIA_API_TOKEN");
    expect(cle.length).toBeGreaterThanOrEqual(20);
    expect(r.text).toContain(cle); // montrée une fois
    expect(await reglage("SESAME_API_TOKEN")).toBe("cle-sesame-inchangee");
    // La clé est chiffrée en base, comme celle de Sesame.
    const ligne = await prisma.appConfig.findUnique({ where: { key: "CHATIA_API_TOKEN" } });
    expect(ligne?.isSecret).toBe(true);
    expect(ligne?.value ?? "").not.toContain(cle);
    expect(
      (
        await new ClientTest().get("/api/chatia/synthese", {
          headers: { Authorization: `Bearer ${cle}` },
        })
      ).status,
    ).toBe(200);
    await c.post("/connecteurs/chatia", { action: "save" });
    expect(await reglage("CHATIA_API_ENABLED")).toBe(false);
  });

  it("le connecteur chatIA est réservé aux admins", async () => {
    await regler({ CHATIA_API_TOKEN: "" });
    await creerUtilisateur("lecteur", "x", "viewer");
    const c = new ClientTest();
    await c.login("lecteur", "x");
    await c.post("/connecteurs/chatia", { action: "generate_key" });
    expect(await reglage("CHATIA_API_TOKEN")).toBeFalsy();
  });
});
