/** L'inventaire se lit en deux familles : Serveurs et Réseau (port de tests/test_inventaire_familles.py). */
import { beforeEach, describe, expect, it } from "vitest";
import {
  EQUIPMENT_FAMILIES,
  EQUIPMENT_KIND_LABELS,
  equipmentFamily,
  equipmentPorte,
} from "@/lib/constantes";
import { detectKind } from "@/modules/inventory/server";
import { clientAdmin } from "./setup/client";
import { prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

const parc = () =>
  prisma.equipment.createMany({
    data: [
      { name: "SRV-APP01", kind: "vm" },
      { name: "ESX-01", kind: "physical" },
      { name: "NAS-BACKUP", kind: "nas" },
      { name: "BAIE-SAN-01", kind: "storage" },
      { name: "SW-CORE-01", kind: "network" },
      { name: "FW-EDGE", kind: "network" },
    ],
  });

describe("natures et familles", () => {
  it("les cinq natures existent", () => {
    expect(new Set(Object.keys(EQUIPMENT_KIND_LABELS))).toEqual(
      new Set(["vm", "physical", "nas", "storage", "network"]),
    );
    expect(EQUIPMENT_KIND_LABELS.storage).toBe("Baie de stockage");
    expect(EQUIPMENT_KIND_LABELS.network).toBe("Équipement réseau");
  });

  it("la baie va aux serveurs, le switch au réseau", () => {
    expect(equipmentFamily("storage")).toBe("serveurs");
    expect(equipmentFamily("network")).toBe("reseau");
    expect(equipmentFamily("licorne")).toBe("serveurs");
  });

  it("chaque famille ne montre que la sienne", async () => {
    const c = await clientAdmin();
    await parc();
    const serveurs = (await c.get("/inventory")).text;
    expect(serveurs).toContain("BAIE-SAN-01");
    expect(serveurs).toContain("SRV-APP01");
    expect(serveurs).not.toContain("SW-CORE-01");
    expect(serveurs).not.toContain("FW-EDGE");
    const reseau = (await c.get("/inventory?famille=reseau")).text;
    expect(reseau).toContain("SW-CORE-01");
    expect(reseau).toContain("FW-EDGE");
    expect(reseau).not.toContain("SRV-APP01");
    expect(reseau).not.toContain("BAIE-SAN-01");
  });

  it("une famille inconnue retombe sur les serveurs", async () => {
    const c = await clientAdmin();
    await parc();
    const b = (await c.get("/inventory?famille=licornes")).text;
    expect(b).toContain("SRV-APP01");
    expect(b).not.toContain("SW-CORE-01");
  });

  it("un onglet de l'autre famille est ignoré", async () => {
    const c = await clientAdmin();
    await parc();
    const b = (await c.get("/inventory?kind=network")).text;
    expect(b).toContain("SRV-APP01");
    expect(b).toContain("BAIE-SAN-01");
  });

  it("le réseau n'affiche pas d'onglets", async () => {
    const c = await clientAdmin();
    await parc();
    let b = (await c.get("/inventory?famille=reseau")).text;
    expect(b).toContain("Switches, pare-feu");
    expect(b).not.toContain("seg-tab-count");
    b = (await c.get("/inventory")).text;
    expect(b).toContain("Baie de stockage");
    expect(b).toContain("seg-tab-count");
  });

  it("créer depuis le réseau ne propose pas VM", async () => {
    const c = await clientAdmin();
    let b = (await c.get("/inventory/create?famille=reseau")).text;
    expect(b).toContain("Équipement réseau");
    expect(b).not.toContain(">VM<");
    expect(b).not.toContain("Baie de stockage");
    b = (await c.get("/inventory/create")).text;
    expect(b).toContain(">VM<");
    expect(b).toContain("Baie de stockage");
    expect(b).not.toContain("Équipement réseau");
  });

  it("une fiche existante peut changer de famille", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({ data: { name: "MAL-CLASSE", kind: "vm" } });
    const b = (await c.get(`/inventory/${e.id}/edit`)).text;
    expect(b).toContain("Équipement réseau");
    expect(b).toContain(">VM<");
  });

  it("création d'un switch", async () => {
    const c = await clientAdmin();
    await c.post(
      "/inventory/create",
      {
        kind: "network",
        name: "SW-ACCES-03",
        ip_address: "10.0.0.3",
        vlan: "10",
        ports: "24",
        manufacturer_model: "Aruba 6100",
        location: "Salle serveur, baie 2",
        management_url: "https://10.0.0.3",
      },
      { followRedirects: true },
    );
    const e = await prisma.equipment.findFirstOrThrow({ where: { name: "SW-ACCES-03" } });
    expect(e.kind).toBe("network");
    expect(e.ports).toBe(24);
    expect(e.location).toBe("Salle serveur, baie 2");
    expect(e.managementUrl).toBe("https://10.0.0.3");
    expect(equipmentFamily(e.kind)).toBe("reseau");
  });

  it("une nature inventée retombe sur VM", async () => {
    const c = await clientAdmin();
    await c.post(
      "/inventory/create",
      { kind: "licorne", name: "BIDON" },
      { followRedirects: true },
    );
    expect((await prisma.equipment.findFirstOrThrow({ where: { name: "BIDON" } })).kind).toBe("vm");
  });

  it("les groupes décident de ce qui s'affiche", () => {
    expect(equipmentPorte("vm", "materiel")).toBe(false);
    expect(equipmentPorte("network", "materiel")).toBe(true);
    expect(equipmentPorte("storage", "materiel")).toBe(true);
    expect(equipmentPorte("network", "ports")).toBe(true);
    expect(equipmentPorte("storage", "ports")).toBe(false);
    expect(equipmentPorte("storage", "stockage")).toBe(true);
    expect(equipmentPorte("network", "stockage")).toBe(false);
    expect(equipmentPorte("physical", "reseau")).toBe(true);
  });

  it("l'ajout rapide propose toutes les natures", async () => {
    const c = await clientAdmin();
    const b = (await c.get("/inventory/create")).text;
    expect(!b.includes("qaModalEquipment") || b.includes("Équipement réseau")).toBe(true);
    const bk = (await c.get("/backups/create")).text;
    expect(bk).toContain("Baie de stockage");
    expect(bk).toContain("Équipement réseau");
  });

  it("l'onglet d'un tableur donne la nature", () => {
    expect(detectKind("Baies de stockage")).toBe("storage");
    expect(detectKind("SAN")).toBe("storage");
    expect(detectKind("Switches")).toBe("network");
    expect(detectKind("Pare-feu")).toBe("network");
    expect(detectKind("Matériel réseau")).toBe("network");
    expect(detectKind("Bornes WiFi")).toBe("network");
    expect(detectKind("NAS")).toBe("nas");
    expect(detectKind("VM")).toBe("vm");
    expect(detectKind("Serveurs physiques")).toBe("physical");
    expect(detectKind("Feuille1")).toBeNull();
  });

  it("les familles couvrent toutes les natures", () => {
    const rangees = new Set(Object.values(EQUIPMENT_FAMILIES).flat());
    expect(rangees).toEqual(new Set(Object.keys(EQUIPMENT_KIND_LABELS)));
  });

  it("la fiche porte les couleurs du formulaire", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({ data: { name: "ESX-ADMIN", kind: "physical" } });
    const fiche = (await c.get(`/inventory/${e.id}`)).text;
    const formulaire = (await c.get(`/inventory/${e.id}/edit`)).text;
    expect(fiche.match(/fiche-titre--(\w+)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(
      fiche.match(/card-header-custom[^>]*>\s*<h6 class="fw-bold fiche-titre fiche-titre--(\w+)/g)
        ?.length ?? 0,
    ).toBeGreaterThanOrEqual(4);
    const couleurs = (html: string) => {
      const out: Record<string, string> = {};
      const motif =
        /fiche-titre--(\w+)[^>]*>\s*(?:<svg[^>]*>[\s\S]*?<\/svg>|<i[^>]*><\/i>)([^<]+?)<\/h6>/g;
      for (const m of html.matchAll(motif)) out[m[2].trim()] = m[1];
      return out;
    };
    const desFiches = couleurs(fiche.split('id="vol-details"', 2)[0]);
    const duFormulaire = couleurs(formulaire);
    const communes = Object.keys(desFiches).filter((t) => t in duFormulaire);
    expect(communes.length).toBeGreaterThan(0);
    for (const titre of communes) expect(desFiches[titre], titre).toBe(duFormulaire[titre]);
  });

  it("la fiche ne délaye plus ses champs", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({
      data: {
        name: "DD3300",
        kind: "physical",
        ipAddress: "172.16.1.28",
        manufacturerModel: "DELL POWERPROTECT DD3300",
        serialNumber: "DE600213144791",
      },
    });
    const html = (await c.get(`/inventory/${e.id}`)).text;
    expect(html).toContain("lu-rangee");
    expect(html).not.toContain("table-borderless");
    for (const v of [
      "172.16.1.28",
      "DELL POWERPROTECT DD3300",
      "DE600213144791",
      "Serveur physique",
    ])
      expect(html).toContain(v);
    expect(html.split("<div").length).toBe(html.split("</div>").length);
  });

  it("service tag sur la fiche et dans la recherche", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({
      data: {
        name: "SRV-DELL-01",
        kind: "physical",
        ipAddress: "172.16.1.29",
        serialNumber: "SN-0001",
        serviceTag: "7XKQ2R3",
      },
    });
    const html = (await c.get(`/inventory/${e.id}`)).text;
    expect(html).toContain("Service Tag");
    expect(html).toContain("7XKQ2R3");
    expect((await c.get("/inventory?q=7XKQ2R3")).text).toContain("SRV-DELL-01");
    expect((await c.get("/inventory?q=ZZZ-INCONNU")).text).not.toContain("SRV-DELL-01");
  });
});
