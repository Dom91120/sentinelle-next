/** Les logiciels et les fournisseurs ont leur propre catégorie de droits (port de tests/test_droits_logiciels_fournisseurs.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { CATEGORY_LABELS, PERMISSION_CATEGORIES } from "@/lib/constantes";
import { migrateRoles } from "@/server/amorcage";
import { ClientTest } from "./setup/client";
import { creerUtilisateur, prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

async function clientPour(permissions: Record<string, number>, nom = "r") {
  await creerUtilisateur(nom, "Role-2026!", nom, permissions);
  const c = new ClientTest();
  await c.login(nom, "Role-2026!");
  return c;
}
const perms = async (name: string) =>
  ((await prisma.role.findUniqueOrThrow({ where: { name } })).permissions ?? {}) as Record<
    string,
    number
  >;
const redirige = (s: number) => s >= 300 && s < 400;

describe("droits", () => {
  it("les deux catégories existent avec leur libellé", () => {
    expect(PERMISSION_CATEGORIES).toContain("software");
    expect(PERMISSION_CATEGORIES).toContain("suppliers");
    expect(CATEGORY_LABELS.software).toBe("Logiciels");
    expect(CATEGORY_LABELS.suppliers).toBe("Fournisseurs");
    expect(CATEGORY_LABELS.inventory).toBe("Matériel");
    expect(CATEGORY_LABELS.contracts).toBe("Contrats");
  });

  it("la migration recopie les niveaux une seule fois", async () => {
    await prisma.role.createMany({
      data: [
        { name: "gestion-parc", permissions: { inventory: 2, contracts: 1 } },
        { name: "catalogue", permissions: { inventory: 3, software: 1, contracts: 0 } },
        { name: "comptes-seuls", permissions: { accounts: 3 } },
      ],
    });
    await migrateRoles();
    let ancien = await perms("gestion-parc");
    expect(ancien.software).toBe(2);
    expect(ancien.suppliers).toBe(1);
    const deja = await perms("catalogue");
    expect(deja.software).toBe(1);
    expect(deja.suppliers).toBe(0);
    expect(await perms("comptes-seuls")).not.toHaveProperty("software");
    await prisma.role.update({
      where: { name: "gestion-parc" },
      data: { permissions: { ...ancien, software: 0 } },
    });
    await migrateRoles();
    ancien = await perms("gestion-parc");
    expect(ancien.software).toBe(0);
  });

  it("les rôles par défaut couvrent les nouvelles catégories", async () => {
    const editor = await perms("editor");
    const viewer = await perms("viewer");
    expect([editor.software, editor.suppliers]).toEqual([3, 3]);
    expect([viewer.software, viewer.suppliers]).toEqual([1, 1]);
  });

  it("le droit logiciels est distinct du matériel", async () => {
    const sw = await prisma.software.create({ data: { name: "GED" } });
    const c = await clientPour({ inventory: 3, software: 0 }, "parc");
    expect((await c.get("/inventory")).status).toBe(200);
    expect(redirige((await c.get("/inventory/logiciels")).status)).toBe(true);
    expect(redirige((await c.get(`/inventory/logiciels/${sw.id}`)).status)).toBe(true);
    expect((await c.get("/search?q=ged")).text).not.toContain("GED");
    expect((await c.get("/")).text).not.toContain('href="/inventory/logiciels"');
  });

  it("le droit fournisseurs est distinct des contrats", async () => {
    const sup = await prisma.supplier.create({ data: { name: "OVHcloud" } });
    const c = await clientPour({ contracts: 3, suppliers: 1 }, "marches");
    expect((await c.get("/contracts")).status).toBe(200);
    expect((await c.get(`/suppliers/${sup.id}`)).status).toBe(200);
    const r = await c.post(`/suppliers/${sup.id}/edit`, { name: "X" });
    expect(redirige(r.status)).toBe(true);
    expect((await prisma.supplier.findUniqueOrThrow({ where: { id: sup.id } })).name).toBe(
      "OVHcloud",
    );
    await c.post("/suppliers/quick-create", { name: "Nouveau" });
    expect(await prisma.supplier.findFirst({ where: { name: "Nouveau" } })).toBeNull();
  });

  it("lecture seule sur les logiciels ne permet pas de créer", async () => {
    const c = await clientPour({ software: 1 }, "lecteur");
    expect((await c.get("/inventory/logiciels")).status).toBe(200);
    await c.post("/inventory/logiciels/create", { name: "Intrus", hosting: "saas" });
    expect(await prisma.software.findFirst({ where: { name: "Intrus" } })).toBeNull();
  });
});
