/** Les logiciels au tableau de bord, dans la conformité, les badges, les listes par statut et le digest (port de test_conformite_logiciels.py et test_logiciels_tableau_de_bord.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { CONFORMITY_CATEGORIES, CONFORMITY_LABELS, WEBHOOK_CATEGORIES } from "@/lib/constantes";
import { getConformityCategories, setConformityCategories } from "@/server/app-settings";
import { buildDailyDigest } from "@/server/digest";
import { setSnooze } from "@/server/snooze";
import { ClientTest, clientAdmin } from "./setup/client";
import { creerUtilisateur, prisma, resetDb } from "./setup/db";
import { entre } from "./setup/html";

beforeEach(resetDb);

const logiciel = (name: string, data: Record<string, unknown> = {}) =>
  prisma.software.create({ data: { name, ...data } });
const majCritique = (sw: { id: number; name: string }) =>
  prisma.systemUpdate.create({
    data: { name: `MAJ ${sw.name}`, status: "critical", softwareId: sw.id },
  });

describe("conformité", () => {
  it("les logiciels comptent par défaut et ont leur libellé", async () => {
    expect(CONFORMITY_CATEGORIES).toContain("software");
    expect(await getConformityCategories()).toContain("software");
    expect(CONFORMITY_LABELS.software).toBe("Logiciels");
    expect(CONFORMITY_LABELS.inventory).toBe("Matériel");
    expect(WEBHOOK_CATEGORIES).toContain("software");
    expect(WEBHOOK_CATEGORIES).toContain("inventory");
    expect(WEBHOOK_CATEGORIES).not.toContain("alerts");
  });

  it("le score compte les logiciels", async () => {
    const c = await clientAdmin();
    await logiciel("Sain");
    await logiciel("Fin de vie", { lifecycle: "fin_de_vie" });
    await setConformityCategories(["software"]);
    expect((await c.get("/")).text).toContain("1 OK sur 2 éléments suivis");
    await setConformityCategories(["accounts"]);
    const html = (await c.get("/")).text;
    expect(html).not.toContain("1 OK sur 2 éléments suivis");
    expect(html).toContain("Logiciels");
  });

  it("la rubrique conformité propose les logiciels", async () => {
    const c = await clientAdmin();
    const html = (await c.get("/preferences")).text;
    expect(html).toContain('value="software"');
    expect(html).toContain("Logiciels");
    await c.post(
      "/preferences",
      { action: "save_conformity", conformity: ["software"] },
      { followRedirects: true },
    );
    expect(await getConformityCategories()).toEqual(["software"]);
  });
});

describe("tableau de bord", () => {
  it("la vignette logiciels compte les statuts", async () => {
    const c = await clientAdmin();
    await logiciel("Sain");
    await logiciel("Fin de vie", { lifecycle: "fin_de_vie" });
    await majCritique(await logiciel("Critique"));
    const html = (await c.get("/")).text;
    expect(html).toContain("Logiciels");
    expect(html).toContain("/inventory/logiciels");
    expect(html).toContain("En fin de vie, successeur à trouver");
    expect(html).toContain("Mise à jour critique en attente");
    expect(entre(html, "À traiter", "</table>")).not.toContain("Sain");
  });

  it("la liste par statut inclut les logiciels", async () => {
    const c = await clientAdmin();
    const sw = await logiciel("Ciril", { lifecycle: "fin_de_vie" });
    const html = (await c.get("/etat/warning")).text;
    expect(html).toContain("Ciril");
    expect(html).toContain(`/inventory/logiciels/${sw.id}`);
    expect((await c.get("/etat/danger")).text).not.toContain("Ciril");
  });

  it("le badge de la barre latérale compte les logiciels critiques", async () => {
    const c = await clientAdmin();
    await majCritique(await logiciel("Critique"));
    await logiciel("Orange", { lifecycle: "fin_de_vie" });
    const bloc = entre((await c.get("/")).text, 'href="/inventory/logiciels"', "</a>");
    expect(bloc).toContain("badge bg-danger");
    expect(bloc).toContain(">1<");
  });

  it("le badge ignore les logiciels en pause", async () => {
    const c = await clientAdmin();
    const sw = await logiciel("Critique");
    await majCritique(sw);
    await setSnooze("software", sw.id, 7);
    expect(entre((await c.get("/")).text, 'href="/inventory/logiciels"', "</a>")).not.toContain(
      "badge bg-danger",
    );
  });

  it("le digest a une rubrique logiciels", async () => {
    await logiciel("Sain");
    await logiciel("Ciril", { lifecycle: "fin_de_vie" });
    await majCritique(await logiciel("Paie"));
    const { text, html, hasUrgent } = await buildDailyDigest("http://sentinelle.lan");
    expect(hasUrgent).toBe(true);
    expect(text).toContain("== Logiciels ==");
    expect(text).toContain("Ciril - En fin de vie");
    expect(text).toContain("Paie - Mise a jour critique");
    expect(text).not.toContain("Sain");
    expect(html).toContain("http://sentinelle.lan/inventory/logiciels/");
  });

  it("le digest respecte le report", async () => {
    const sw = await logiciel("Ciril", { lifecycle: "fin_de_vie" });
    await setSnooze("software", sw.id, 7);
    const { text, hasUrgent } = await buildDailyDigest();
    expect(hasUrgent).toBe(false);
    expect(text).not.toContain("Ciril");
  });

  it("sans droit inventaire, ni vignette ni urgence", async () => {
    await logiciel("Ciril", { lifecycle: "fin_de_vie" });
    await creerUtilisateur("lc", "Lecteur-2026!", "lecteur-comptes", { accounts: 1 });
    const c = new ClientTest();
    await c.login("lc", "Lecteur-2026!");
    expect((await c.get("/")).text).not.toContain("Ciril");
  });
});
