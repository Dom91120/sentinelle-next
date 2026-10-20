/** Surveillance Certificate Transparency : ligne de base, détection, déduplication, report, acquittement (port de tests/test_ct.py). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientAdmin } from "./setup/client";
import { prisma, regler, resetDb } from "./setup/db";

vi.mock("@/server/mailer", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/mailer")>();
  return { ...mod, sendEmail: vi.fn(async () => true) };
});

import {
  type CtCert,
  cleanDomainCt,
  normalizeCt,
  parseJour,
  scanDomain,
} from "@/modules/domains/server";
import { setSnooze } from "@/server/snooze";

const d = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j));

function cert(cid: number, name = "www.exemple.fr", issuer = "Let's Encrypt"): CtCert {
  return {
    crtshId: cid,
    serialNumber: cid.toString(16),
    commonName: name,
    nameValue: name,
    issuerName: issuer,
    notBefore: d(2026, 1, 1),
    notAfter: d(2026, 4, 1),
    entryTimestamp: new Date(Date.UTC(2026, 0, 1)),
  };
}

const fetcher = (certs: CtCert[]) => async () => [...certs];
const domaine = () => prisma.domain.create({ data: { name: "exemple.fr" } });
const recharger = (id: number) => prisma.domain.findUniqueOrThrow({ where: { id } });
const alertesCt = (status?: string) =>
  prisma.alertLog.count({ where: { entityType: "ct", ...(status ? { status } : {}) } });

beforeEach(async () => {
  await resetDb();
  await regler({ ALERT_RECIPIENTS: ["dsi@exemple.fr"] });
});

describe("scan CT", () => {
  it("le premier scan établit la ligne de base sans alerte", async () => {
    const dom = await domaine();
    const res = await scanDomain(dom, "auto-ct", fetcher([cert(1), cert(2)]));
    expect(res.baseline).toBe(2);
    expect(res.new).toEqual([]);
    expect(Number((await recharger(dom.id)).ctLastId)).toBe(2);
    expect(await prisma.ctLogEntry.count({ where: { status: "baseline" } })).toBe(2);
    expect(await alertesCt()).toBe(0);
  });

  it("un nouveau certificat est détecté et alerte", async () => {
    const dom = await domaine();
    await scanDomain(dom, "auto-ct", fetcher([cert(1), cert(2)]));
    const res = await scanDomain(
      await recharger(dom.id),
      "auto-ct",
      fetcher([cert(1), cert(2), cert(3)]),
    );
    expect(res.new).toHaveLength(1);
    expect(Number(res.new[0].crtshId)).toBe(3);
    expect(res.new[0].status).toBe("new");
    expect(Number((await recharger(dom.id)).ctLastId)).toBe(3);
    expect(await alertesCt("sent")).toBe(1);
  });

  it("déduplication : pas de nouvelle alerte", async () => {
    const dom = await domaine();
    await scanDomain(dom, "auto-ct", fetcher([cert(1)]));
    await scanDomain(await recharger(dom.id), "auto-ct", fetcher([cert(1), cert(2)]));
    const res = await scanDomain(await recharger(dom.id), "auto-ct", fetcher([cert(1), cert(2)]));
    expect(res.new).toEqual([]);
    expect(await prisma.ctLogEntry.count()).toBe(2);
    expect(await alertesCt("sent")).toBe(1);
  });

  it("le report supprime l'alerte mais enregistre", async () => {
    const dom = await domaine();
    await scanDomain(dom, "auto-ct", fetcher([cert(1)]));
    await setSnooze("domain", dom.id, 7, "maintenance", "admin");
    const res = await scanDomain(await recharger(dom.id), "auto-ct", fetcher([cert(1), cert(2)]));
    expect(res.new).toHaveLength(1);
    expect(await alertesCt()).toBe(0);
  });

  it("un scan en échec journalise sans planter", async () => {
    const dom = await domaine();
    const res = await scanDomain(dom, "auto-ct", async () => {
      throw new Error("crt.sh injoignable");
    });
    expect(res.error).toBe("crt.sh injoignable");
    expect((await recharger(dom.id)).ctLastId).toBeNull();
  });

  it("acquittement par la route", async () => {
    const c = await clientAdmin();
    const dom = await domaine();
    await scanDomain(dom, "auto-ct", fetcher([cert(1)]));
    await scanDomain(await recharger(dom.id), "auto-ct", fetcher([cert(1), cert(2)]));
    expect(await prisma.ctLogEntry.count({ where: { domainId: dom.id, status: "new" } })).toBe(1);
    const r = await c.post(`/domains/${dom.id}/ct-ack`, {}, { followRedirects: true });
    expect(r.status).toBe(200);
    expect(await prisma.ctLogEntry.count({ where: { domainId: dom.id, status: "new" } })).toBe(0);
  });
});

describe("normalisation pure", () => {
  it("clean_domain", () => {
    expect(cleanDomainCt("https://www.Exemple.fr/path")).toBe("www.exemple.fr");
    expect(cleanDomainCt("*.exemple.fr")).toBe("exemple.fr");
    expect(cleanDomainCt("exemple.fr:443")).toBe("exemple.fr");
  });

  it("normalize ignore un id absent", () => {
    expect(normalizeCt({ common_name: "x" })).toBeNull();
    const row = normalizeCt({ id: 42, name_value: "a\nb", not_before: "2026-01-02T00:00:00" });
    expect(row?.crtshId).toBe(42);
    expect(parseJour("2026-01-02T00:00:00")).toEqual(d(2026, 1, 2));
  });
});
