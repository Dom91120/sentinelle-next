/** Précédent / suivant en tête des fiches, et le sélecteur « lignes par page » (port de test_voisins.py et test_pagination.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { clientAdmin } from "./setup/client";
import { prisma, regler, resetDb } from "./setup/db";

beforeEach(resetDb);

const d2030 = new Date(Date.UTC(2030, 0, 1));

describe("voisins", () => {
  async function comptes() {
    const objs: Record<string, { id: number }> = {};
    for (const n of ["Zimbra", "alfresco", "Nextcloud"])
      objs[n] = await prisma.account.create({
        data: { serviceName: n, username: "admin", rotationDays: 90, nextPasswordChange: d2030 },
      });
    return objs;
  }

  it("les chevrons suivent l'ordre des noms", async () => {
    const c = await clientAdmin();
    const o = await comptes();
    const html = (await c.get(`/accounts/${o.Nextcloud.id}`)).text;
    expect(html).toContain(`href="/accounts/${o.alfresco.id}"`);
    expect(html).toContain("Précédente : alfresco");
    expect(html).toContain(`href="/accounts/${o.Zimbra.id}"`);
    expect(html).toContain("Suivante : Zimbra");
  });

  it("les chevrons suivent l'ordre de la liste : le plus urgent en tête", async () => {
    const c = await clientAdmin();
    const compte = (serviceName: string, nextPasswordChange: Date | null) =>
      prisma.account.create({
        data: { serviceName, username: "admin", rotationDays: 90, nextPasswordChange },
      });
    // Expiré (rouge), sans date (orange, « à renseigner »), lointain (vert).
    const expire = await compte("Zimbra", new Date(Date.UTC(2020, 0, 1)));
    const sansDate = await compte("Nextcloud", null);
    const lointain = await compte("alfresco", d2030);
    const liste = (await c.get("/accounts")).text;
    const pos = (id: number) => liste.indexOf(`href="/accounts/${id}"`);
    expect(pos(expire.id)).toBeLessThan(pos(sansDate.id));
    expect(pos(sansDate.id)).toBeLessThan(pos(lointain.id));
    const html = (await c.get(`/accounts/${sansDate.id}`)).text;
    expect(html).toContain("Précédente : Zimbra");
    expect(html).toContain("Suivante : alfresco");
  });

  it("un bout garde son chevron grisé", async () => {
    const c = await clientAdmin();
    const o = await comptes();
    let html = (await c.get(`/accounts/${o.alfresco.id}`)).text;
    expect(html).not.toContain("Précédente :");
    expect(html).toContain("Suivante : Nextcloud");
    expect(html).toContain("btn-icon disabled");
    html = (await c.get(`/accounts/${o.Zimbra.id}`)).text;
    expect(html).toContain("Précédente : Nextcloud");
    expect(html).not.toContain("Suivante :");
  });

  it("une fiche seule n'a pas de chevrons", async () => {
    const c = await clientAdmin();
    const seul = await prisma.account.create({
      data: { serviceName: "Seul", username: "admin", rotationDays: 90, nextPasswordChange: d2030 },
    });
    expect((await c.get(`/accounts/${seul.id}`)).text).not.toContain("fiche-voisins");
  });

  it("une fiche désactivée ne compte pas", async () => {
    const c = await clientAdmin();
    const o = await comptes();
    await prisma.account.update({ where: { id: o.Nextcloud.id }, data: { isActive: false } });
    const html = (await c.get(`/accounts/${o.alfresco.id}`)).text;
    expect(html).toContain("Suivante : Zimbra");
    expect(html).not.toContain("Nextcloud");
  });

  it("le nom de la fiche dépend du module", async () => {
    const c = await clientAdmin();
    const r1 = await prisma.accessReview.create({
      data: { application: "GLPI", frequencyDays: 365 },
    });
    await prisma.accessReview.create({ data: { application: "SIRH", frequencyDays: 365 } });
    await prisma.certificate.create({
      data: { kind: "tls", serviceName: "API", domain: "api.fr", expiryDate: d2030 },
    });
    const c2 = await prisma.certificate.create({
      data: { kind: "tls", serviceName: "Portail", domain: "portail.fr", expiryDate: d2030 },
    });
    expect((await c.get(`/reviews/${r1.id}`)).text).toContain("Suivante : SIRH");
    expect((await c.get(`/certificates/${c2.id}`)).text).toContain("Précédente : API");
  });

  it("le feuilletage se coupe dans les préférences", async () => {
    const c = await clientAdmin();
    const o = await comptes();
    await regler({ FICHE_NAVIGATION: false });
    expect((await c.get(`/accounts/${o.Nextcloud.id}`)).text).not.toContain("fiche-voisins");
  });
});

describe("pagination", () => {
  const trenteComptes = () =>
    prisma.account.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        serviceName: `Service ${String(i).padStart(2, "0")}`,
        username: `u${i}`,
      })),
    });
  const selecteur = (html: string) => {
    const m = html.match(/<select class="form-select pagination-perpage"[\s\S]*?<\/select>/);
    if (!m) throw new Error("pas de sélecteur de lignes par page");
    return m[0];
  };
  const optionChoisie = (html: string): [string, string] => {
    const sel = selecteur(html);
    const m =
      sel.match(/<option[^>]*value="([^"]+)"[^>]*selected(?:="")?[^>]*>([^<]+)<\/option>/) ??
      sel.match(/<option[^>]*selected(?:="")?[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/);
    if (!m) throw new Error("aucune option choisie");
    return [m[1], m[2]];
  };

  it("la liste des comptes porte le sélecteur", async () => {
    const c = await clientAdmin();
    await trenteComptes();
    const html = (await c.get("/accounts")).text;
    expect(html).toContain("1–10 sur 30");
    const [url, libelle] = optionChoisie(html);
    expect(libelle).toBe("10 / page");
    expect(url).toContain("per_page=10");
    expect(selecteur(html)).toContain("/accounts?per_page=25");
    expect(selecteur(html)).toContain("per_page=all");
  });

  it("la taille demandée est appliquée", async () => {
    const c = await clientAdmin();
    await trenteComptes();
    const html = (await c.get("/accounts?per_page=25")).text;
    expect(html).toContain("1–25 sur 30");
    expect(optionChoisie(html)[1]).toBe("25 / page");
    const vingt = (await c.get("/accounts?per_page=20")).text;
    expect(vingt).toContain("1–20 sur 30");
    expect(optionChoisie(vingt)[1]).toBe("20 / page");
    const quinze = (await c.get("/accounts?per_page=15")).text;
    expect(quinze).toContain("1–15 sur 30");
    expect(optionChoisie(quinze)[1]).toBe("15 / page");
    const tout = (await c.get("/accounts?per_page=all")).text;
    expect(optionChoisie(tout)[1]).toBe("Tous");
    expect(tout.split("Service ").length - 1).toBeGreaterThanOrEqual(30);
    expect((await c.get("/accounts?per_page=7")).text).toContain("1–10 sur 30");
  });

  it("le choix garde les filtres et revient en page 1", async () => {
    const c = await clientAdmin();
    await trenteComptes();
    const html = (await c.get("/accounts?q=Service&page=2&per_page=10")).text;
    expect(html).toContain("11–20 sur 30");
    const sel = selecteur(html);
    expect(sel).toContain("q=Service");
    expect(sel.replace(/per_page=/g, "")).not.toContain("page=");
    expect(html).toMatch(
      /<input[^>]*name="per_page"[^>]*value="10"|<input[^>]*value="10"[^>]*name="per_page"/,
    );
  });

  it("le journal d'audit porte le sélecteur", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/users/audit")).text;
    expect(html).toContain("pagination-perpage");
    expect(optionChoisie(html)[1]).toBe("10 / page");
    expect(optionChoisie((await c.get("/users/audit?per_page=25")).text)[1]).toBe("25 / page");
  });

  it("l'inventaire porte le même sélecteur", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/inventory")).text;
    expect(html.split("pagination-perpage").length - 1).toBe(1);
    expect(optionChoisie(html)[1]).toBe("10 / page");
  });

  it("la taille choisie est retenue liste par liste", async () => {
    const c = await clientAdmin();
    await trenteComptes();
    await prisma.supplier.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        name: `Fournisseur ${String(i).padStart(2, "0")}`,
      })),
    });
    await c.get("/accounts?per_page=25");
    const html = (await c.get("/accounts")).text;
    expect(html).toContain("1–25 sur 30");
    expect(optionChoisie(html)[1]).toBe("25 / page");
    expect((await c.get("/suppliers")).text).toContain("1–10 sur 30");
    await c.get("/accounts?per_page=all");
    expect(optionChoisie((await c.get("/accounts")).text)[1]).toBe("Tous");
    await regler({ PAGINATION_MEMORY: false });
    expect((await c.get("/accounts")).text).toContain("1–10 sur 30");
  });
});
