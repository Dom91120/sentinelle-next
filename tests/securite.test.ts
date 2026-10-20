/** Sécurité du login : anti-bruteforce par (identifiant, IP) et 2FA admin (port de tests/test_securite.py). */
import { createOTP } from "@better-auth/utils/otp";
import { beforeEach, describe, expect, it } from "vitest";
import { ClientTest } from "./setup/client";
import { ADMIN_PASSWORD, admin, prisma, regler, resetDb } from "./setup/db";

beforeEach(resetDb);

const login = (c: ClientTest, username: string, password: string, ip: string) =>
  c.login(username, password, { "X-Forwarded-For": ip });
const redirige = (status: number) => status >= 300 && status < 400;

describe("anti-bruteforce", () => {
  it("un blocage par IP n'affecte pas les autres IP", async () => {
    // LOGIN_MAX_ATTEMPTS = 3 (environnement du serveur de test)
    const c = new ClientTest();
    for (let i = 0; i < 3; i++) await login(c, "admin", "mauvais", "10.0.0.66");
    const th = await prisma.loginThrottle.findFirst({
      where: { username: "admin", ip: "10.0.0.66" },
    });
    expect(th?.lockedUntil).toBeTruthy();
    // IP A bloquée
    const r = await login(c, "admin", ADMIN_PASSWORD, "10.0.0.66");
    expect((await c.get(r.location ?? "/login")).text).toContain("Trop de tentatives");
    // IP B (utilisateur légitime) : connexion possible
    const r2 = await login(new ClientTest(), "admin", ADMIN_PASSWORD, "192.168.1.10");
    expect(redirige(r2.status)).toBe(true);
    expect(r2.location ?? "").not.toContain("/login");
  });

  it("falsifier X-Forwarded-For ne contourne pas le blocage", async () => {
    const c = new ClientTest();
    for (let i = 0; i < 5; i++) await login(c, "admin", "mauvais", `1.2.3.${i}, 10.0.0.66`);
    const th = await prisma.loginThrottle.findFirst({
      where: { username: "admin", ip: "10.0.0.66" },
    });
    expect(th?.lockedUntil).toBeTruthy();
    expect(await prisma.loginThrottle.count({ where: { ip: { startsWith: "1.2.3." } } })).toBe(0);
  });
});

describe("2FA admin obligatoire", () => {
  it("redirige vers le profil", async () => {
    await regler({ REQUIRE_2FA_ADMIN: true });
    const c = new ClientTest();
    await login(c, "admin", ADMIN_PASSWORD, "127.0.0.1");
    const r = await c.get("/inventory");
    expect(redirige(r.status)).toBe(true);
    expect(r.location ?? "").toContain("/profile");
    expect((await c.get("/profile")).status).toBe(200);
  });

  it("non imposée si l'option est coupée", async () => {
    await regler({ REQUIRE_2FA_ADMIN: false });
    const c = new ClientTest();
    await login(c, "admin", ADMIN_PASSWORD, "127.0.0.1");
    expect((await c.get("/inventory")).status).toBe(200);
  });
});

/** L'admin avec un second facteur actif ; retourne le secret TOTP. */
async function adminAvec2fa(): Promise<string> {
  const { initTwoFactor } = await import("@/server/two-factor");
  const a = await admin();
  const { secret } = await initTwoFactor(a.id, a.username);
  await prisma.twoFactor.updateMany({ where: { userId: a.id }, data: { verified: true } });
  await prisma.user.update({ where: { id: a.id }, data: { twoFactorEnabled: true } });
  return secret;
}
const codeBon = (secret: string) => createOTP(secret, { digits: 6, period: 30 }).totp();
const codeFaux = async (secret: string) =>
  (await codeBon(secret)) !== "000000" ? "000000" : "111111";

describe("2FA : le compteur d'essais vit en base", () => {
  it("rejouer le cookie ne remet pas le compteur à zéro", async () => {
    const secret = await adminAvec2fa();
    const c = new ClientTest();
    const r = await login(c, "admin", ADMIN_PASSWORD, "10.0.0.1");
    expect(r.location ?? "").toContain("/2fa");
    const cookiesAvant = [
      "sentinelle_2fa",
      "better-auth.two_factor",
      "__Secure-better-auth.two_factor",
    ]
      .map((n) => [n, c.cookie(n)] as const)
      .filter(([, v]) => v);

    for (let i = 0; i < 3; i++) await c.post("/2fa", { code: await codeFaux(secret) });
    expect((await admin()).totpLockedUntil).toBeTruthy();

    // Rejeu du cookie « 0 essai » avec le BON code : toujours refusé.
    const rejeu = new ClientTest();
    for (const [n, v] of cookiesAvant) rejeu.setCookie(n, v as string);
    const r2 = await rejeu.post("/2fa", { code: await codeBon(secret) });
    expect(r2.location ?? "").toContain("/login");
    expect(redirige((await rejeu.get("/inventory")).status)).toBe(true);
  });

  it("se reconnecter ne redonne pas d'essais", async () => {
    const secret = await adminAvec2fa();
    const c = new ClientTest();
    for (let i = 0; i < 3; i++) {
      await login(c, "admin", ADMIN_PASSWORD, "10.0.0.1");
      await c.post("/2fa", { code: await codeFaux(secret) });
    }
    await login(c, "admin", ADMIN_PASSWORD, "10.0.0.1");
    const r = await c.post("/2fa", { code: await codeBon(secret) });
    expect(r.location ?? "").toContain("/login");
  });

  it("un bon code remet le compteur à zéro", async () => {
    const secret = await adminAvec2fa();
    const c = new ClientTest();
    await login(c, "admin", ADMIN_PASSWORD, "10.0.0.1");
    await c.post("/2fa", { code: await codeFaux(secret) });
    const r = await c.post("/2fa", { code: await codeBon(secret) });
    expect(r.location ?? "").not.toContain("/login");
    expect((await admin()).totpFailedCount).toBe(0);
    expect((await c.get("/inventory")).status).toBe(200);
  });
});

describe("LDAP : un compte AD homonyme n'ouvre pas un compte local", () => {
  it("compte AD homonyme refusé, mot de passe local toujours valable", async () => {
    await regler({
      LDAP_ENABLED: true,
      LDAP_SERVER: "dc.test",
      SENTINELLE_TEST_LDAP_ACCEPT: "admin:mdp-ad",
    });
    const c = new ClientTest();
    const r = await login(c, "admin", "mdp-ad", "10.0.0.1");
    expect((await c.get(r.location ?? "/login")).text).toContain("Identifiants incorrects");
    expect(redirige((await c.get("/inventory")).status)).toBe(true);
    const r2 = await login(c, "admin", ADMIN_PASSWORD, "10.0.0.1");
    expect(redirige(r2.status) && !(r2.location ?? "").includes("/login")).toBe(true);
  });

  it("un compte AD ouvre toujours son propre compte", async () => {
    await regler({
      LDAP_ENABLED: true,
      LDAP_SERVER: "dc.test",
      SENTINELLE_TEST_LDAP_ACCEPT: "jdupont:mdp-ad",
    });
    const c = new ClientTest();
    const r = await login(c, "jdupont", "mdp-ad", "10.0.0.1");
    expect(redirige(r.status) && !(r.location ?? "").includes("/login")).toBe(true);
    const u = await prisma.user.findUnique({ where: { username: "jdupont" } });
    expect(u?.authSource).toBe("ldap");
    expect(u?.role).not.toBe("admin");
    const r2 = await login(new ClientTest(), "jdupont", "mdp-ad", "10.0.0.1");
    expect(redirige(r2.status) && !(r2.location ?? "").includes("/login")).toBe(true);
  });
});
