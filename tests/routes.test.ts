/** Routes transverses : sonde de supervision, agenda et export ICS, corbeille, fiches (port de tests/test_routes.py). */
import { beforeEach, describe, expect, it } from "vitest";
import { ClientTest, clientAdmin } from "./setup/client";
import { admin, jour, prisma, resetDb } from "./setup/db";

beforeEach(resetDb);

describe("routes", () => {
  it("le tableau de bord se charge pour un admin", async () => {
    const c = await clientAdmin();
    expect((await c.get("/")).status).toBe(200);
  });

  it("l'agenda inclut garanties et contrats", async () => {
    const c = await clientAdmin();
    await prisma.equipment.create({ data: { name: "SRV-GARANTIE", warrantyEnd: jour(20) } });
    await prisma.contract.create({
      data: { name: "Maintenance baie", kind: "maintenance", endDate: jour(30) },
    });
    const body = (await c.get("/agenda")).text;
    expect(body).toContain("SRV-GARANTIE");
    expect(body.toLowerCase()).toContain("garantie");
    expect(body).toContain("Maintenance baie");
    const ics = (await c.get("/agenda.ics")).text;
    expect(ics).toContain("SRV-GARANTIE");
    expect(ics).toContain("Maintenance baie");
  });

  it("healthz sans authentification", async () => {
    const r = await new ClientTest().get("/healthz");
    expect(r.status).toBe(200);
    const data = r.json<{ status: string; scheduler: string }>();
    expect(data.status).toBe("ok");
    expect(data.scheduler).toBe("no_run_yet");
  });

  it("healthz : planificateur en panne", async () => {
    await prisma.schedulerRun.create({
      data: {
        jobId: "check_passwords",
        status: "ok",
        runAt: new Date(Date.now() - 30 * 3_600_000),
      },
    });
    const r = await new ClientTest().get("/healthz");
    expect(r.status).toBe(503);
    expect(r.json<{ scheduler: string }>().scheduler).toBe("stale");
  });

  it("healthz : planificateur récent", async () => {
    await prisma.schedulerRun.create({
      data: { jobId: "check_passwords", status: "ok", runAt: new Date(Date.now() - 2 * 3_600_000) },
    });
    expect((await new ClientTest().get("/healthz")).status).toBe(200);
  });

  it("agenda ICS", async () => {
    const c = await clientAdmin();
    await prisma.certificate.create({
      data: { serviceName: "Portail RH", domain: "rh.exemple.fr", expiryDate: jour(12) },
    });
    const r = await c.get("/agenda.ics");
    expect(r.status).toBe(200);
    expect(r.mimetype).toBe("text/calendar");
    expect(r.text).toContain("BEGIN:VCALENDAR");
    expect(r.text).toContain("END:VCALENDAR");
    expect(r.text).toContain("Portail RH");
    expect(r.text).toContain("DTSTART;VALUE=DATE:");
  });

  it("agenda ICS exige une connexion", async () => {
    const r = await new ClientTest().get("/agenda.ics");
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.status).toBeLessThan(400);
  });

  it("abonnement ICS par jeton", async () => {
    const c = await clientAdmin();
    const r = await c.post("/agenda/ics-token");
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.status).toBeLessThan(400);
    const token = (await admin()).icsToken;
    expect(token).toBeTruthy();

    const anonyme = new ClientTest();
    const ok = await anonyme.get(`/agenda.ics?token=${token}`);
    expect(ok.status).toBe(200);
    expect(ok.mimetype).toBe("text/calendar");
    expect(ok.headers.get("content-disposition")).toBeNull(); // flux, pas de téléchargement forcé
    expect((await anonyme.get("/agenda.ics?token=jeton-invalide")).status).toBe(403);

    await c.post("/agenda/ics-token", { action: "disable" });
    expect((await admin()).icsToken).toBeNull();
    expect((await anonyme.get(`/agenda.ics?token=${token}`)).status).toBe(403);
  });

  it("corbeille : un équipement se restaure et sa purge détache les éléments liés", async () => {
    const { listTrashed, purgeOne, restore } = await import("@/server/corbeille");
    const { loadUser } = await import("@/server/guards");
    const a = await loadUser((await admin()).id);
    if (!a) throw new Error("admin");
    const e = await prisma.equipment.create({ data: { name: "SRV-OBSOLETE", isActive: false } });
    const groupes = Object.fromEntries((await listTrashed(a)).map((g) => [g.etype, g]));
    expect(groupes.equipment).toBeTruthy();
    expect(groupes.equipment.items[0].name).toBe("SRV-OBSOLETE");

    expect(await restore(a, "equipment", String(e.id), "admin")).toEqual([
      "Matériel",
      "SRV-OBSOLETE",
    ]);
    expect((await prisma.equipment.findUnique({ where: { id: e.id } }))?.isActive).toBe(true);

    const e2 = await prisma.equipment.create({ data: { name: "SRV-A-PURGER", isActive: false } });
    const cert = await prisma.certificate.create({
      data: { serviceName: "svc", domain: "d.fr", expiryDate: jour(0), equipmentId: e2.id },
    });
    expect(await purgeOne(a, "equipment", String(e2.id))).toEqual(["Matériel", "SRV-A-PURGER"]);
    expect(
      (await prisma.certificate.findUnique({ where: { id: cert.id } }))?.equipmentId,
    ).toBeNull();
    expect(await prisma.equipment.findUnique({ where: { id: e2.id } })).toBeNull();
  });

  it("fiche équipement : vue 360°", async () => {
    const c = await clientAdmin();
    const e = await prisma.equipment.create({
      data: { name: "SRV-PROD-01", kind: "vm", criticality: 3 },
    });
    await prisma.certificate.create({
      data: {
        serviceName: "Intranet",
        domain: "intra.exemple.fr",
        expiryDate: jour(90),
        equipmentId: e.id,
      },
    });
    await prisma.backup.create({
      data: { serviceName: "Veeam SRV-PROD-01", frequency: "daily", equipmentId: e.id },
    });
    const r = await c.get(`/inventory/${e.id}`);
    expect(r.status).toBe(200);
    expect(r.text).toContain("Éléments liés");
    expect(r.text).toContain("intra.exemple.fr");
    expect(r.text).toContain("Veeam SRV-PROD-01");
  });

  it("fiche équipement : sections par type", async () => {
    const c = await clientAdmin();
    const kinds = {
      "VM-T": "vm",
      "PHY-T": "physical",
      "NAS-T": "nas",
      "BAIE-T": "storage",
      "SW-T": "network",
    };
    const ids: Record<string, number> = {};
    for (const [name, kind] of Object.entries(kinds))
      ids[name] = (await prisma.equipment.create({ data: { name, kind } })).id;
    const fiche = async (name: string) => {
      const html = (await c.get(`/inventory/${ids[name]}`)).text;
      return html.split('id="vol-detail"', 2)[1].split('id="vol-details"', 2)[0];
    };
    let b = await fiche("VM-T");
    expect(b).toContain("Hyperviseur");
    expect(b).toContain("Adresse IP");
    expect(b).toContain("Continuité");
    expect(b).toContain("Sauvegarde 2");
    expect(b).not.toContain("N° de série");
    expect(b).not.toContain("Protocoles");

    b = await fiche("PHY-T");
    expect(b).toContain("N° de série");
    expect(b).toContain("PRA / PCA");
    expect(b).toContain("Continuité");
    expect(b).toContain("Adresse IP");
    expect(b).not.toContain("Protocoles");
    expect(b).not.toContain("Hyperviseur");

    b = await fiche("NAS-T");
    expect(b).toContain("Protocoles");
    expect(b).toContain("N° de série");
    expect(b).toContain("Adresse IP");
    expect(b.includes('data-manque="Usage"') || b.includes("Usage / données stockées")).toBe(true);

    b = await fiche("BAIE-T");
    expect(b).toContain("Protocoles");
    expect(b).toContain("N° de série");
    expect(b).toContain("Adresse IP");
    expect(b).toContain("PRA / PCA");
    expect(b).not.toContain("Hyperviseur");

    b = await fiche("SW-T");
    expect(b).toContain("N° de série");
    expect(b).toContain("Adresse IP");
    expect(b).toContain("VLAN");
    expect(b.includes('data-manque="Ports"') || b.includes("Nombre de ports")).toBe(true);
    expect(b).not.toContain("Protocoles");
    expect(b).not.toContain("Hyperviseur");
  });

  it("le tableau de bord nomme les échéances comme l'agenda", async () => {
    const c = await clientAdmin();
    await prisma.certificate.create({
      data: {
        kind: "signature",
        serviceName: "Élus",
        civility: "mme",
        firstName: "Elodie",
        holder: "DORFIAC",
        expiryDate: jour(20),
      },
    });
    await prisma.account.create({
      data: {
        serviceName: "Active Directory",
        username: "svc-backup",
        nextPasswordChange: jour(15),
      },
    });
    const body = (await c.get("/")).text;
    expect(body).toContain("Élus - Mme DORFIAC Elodie");
    expect(body).not.toContain("Élus - None");
    expect(body).toContain("Active Directory (svc-backup)");
  });
});
