/** Corrections issues de l'audit : garde-fous d'autorisation, alertes alignées sur le statut, corbeille (port de tests/test_corrections.py). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientAdmin } from "./setup/client";
import { admin, creerUtilisateur, jour, prisma, regler, resetDb } from "./setup/db";

vi.mock("@/server/alerts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/alerts")>();
  return { ...mod, sendAlert: vi.fn(async () => true) };
});

import { sendAlert } from "@/server/alerts";
import { restore } from "@/server/corbeille";
import { chargerTout } from "@/server/donnees";
import { loadUser } from "@/server/guards";
import {
  checkCertificates,
  checkDomains,
  checkPasswords,
  checkReviews,
  checkTests,
} from "@/server/taches";

const mock = vi.mocked(sendAlert);
const redirige = (s: number) => s >= 300 && s < 400;

beforeEach(async () => {
  await resetDb();
  mock.mockClear();
});

describe("corrections", () => {
  it("créer un compte avec une rotation vide ne plante pas", async () => {
    const c = await clientAdmin();
    const r = await c.post("/accounts/create", {
      service_name: "Test",
      username: "svc",
      rotation_days: "",
    });
    expect(redirige(r.status)).toBe(true);
    const a = await prisma.account.findFirst({ where: { serviceName: "Test" } });
    expect(a?.rotationDays).toBe(90); // défaut appliqué
  });

  it("un admin ne peut pas changer son propre rôle", async () => {
    const c = await clientAdmin();
    const a = await admin();
    await c.post(
      `/users/${a.id}/edit`,
      { email: a.email, role: "viewer" },
      { followRedirects: true },
    );
    expect((await admin()).role).toBe("admin");
  });

  it("la suppression du dernier admin est refusée", async () => {
    const c = await clientAdmin();
    await creerUtilisateur("lecteur", "x", "viewer");
    await c.post(`/users/${(await admin()).id}/delete`, {}, { followRedirects: true });
    expect(await prisma.user.findUnique({ where: { username: "admin" } })).not.toBeNull();
  });

  it("un test en échec déclenche une alerte", async () => {
    await regler({ ALERT_RECIPIENTS: ["dsi@x.fr"] });
    await prisma.testTask.create({
      data: { name: "Restauration", testType: "restoration", status: "failed", nextDue: null },
    });
    await checkTests(await chargerTout());
    expect(mock.mock.calls.some((c) => c[2] === "test")).toBe(true);
  });

  it("une revue en échec déclenche une alerte", async () => {
    await regler({ ALERT_RECIPIENTS: ["dsi@x.fr"] });
    await prisma.accessReview.create({
      data: { application: "SIRH", status: "failed", nextReview: null },
    });
    await checkReviews(await chargerTout());
    expect(mock.mock.calls.some((c) => c[2] === "review")).toBe(true);
  });

  it("restore refuse un élément actif", async () => {
    const a = await loadUser((await admin()).id);
    if (!a) throw new Error("admin");
    const compte = await prisma.account.create({ data: { serviceName: "Actif", username: "u" } });
    expect(await restore(a, "account", String(compte.id), "admin")).toBeNull();
    await prisma.account.update({ where: { id: compte.id }, data: { isActive: false } });
    expect(await restore(a, "account", String(compte.id), "admin")).not.toBeNull();
  });

  it("un certificat qui expire dans 5 jours envoie une alerte", async () => {
    await prisma.certificate.create({
      data: { serviceName: "TestCert", domain: "test.example.com", expiryDate: jour(5) },
    });
    await checkCertificates(await chargerTout());
    expect(mock).toHaveBeenCalled();
    const [subject, body] = mock.mock.calls[0];
    expect(String(subject).includes("TestCert") || String(body).includes("TestCert")).toBe(true);
  });

  it("un certificat OK n'envoie pas d'alerte", async () => {
    await prisma.certificate.create({
      data: { serviceName: "CertOK", domain: "ok.example.com", expiryDate: jour(200) },
    });
    await checkCertificates(await chargerTout());
    expect(mock).not.toHaveBeenCalled();
  });

  it("un mot de passe expiré envoie une alerte", async () => {
    await prisma.account.create({
      data: { serviceName: "ServiceExpire", username: "user@test", nextPasswordChange: jour(-1) },
    });
    await checkPasswords(await chargerTout());
    expect(mock).toHaveBeenCalled();
  });

  it("un domaine qui expire dans 15 jours envoie une alerte", async () => {
    await prisma.domain.create({ data: { name: "expire-bientot.fr", expiryDate: jour(15) } });
    await checkDomains(await chargerTout());
    expect(mock).toHaveBeenCalled();
  });

  it("/health répond 200 avec des compteurs", async () => {
    const c = await clientAdmin();
    const r = await c.get("/health");
    expect(r.status).toBe(200);
    const data = r.json<{ status: string; counts: unknown }>();
    expect(data.status).toBe("ok");
    expect(data).toHaveProperty("counts");
  });
});
