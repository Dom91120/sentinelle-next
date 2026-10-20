/**
 * Authentification LDAP / Active Directory (port de app/ldap_auth.py), en
 * complément du compte local : on tente d'abord le mot de passe local, puis
 * (si activé) un bind LDAP. Un utilisateur AD valide est provisionné
 * automatiquement avec le rôle par défaut configuré.
 */
import { readFileSync } from "node:fs";
import { Client, type ClientOptions } from "ldapts";
import type { AppSettings } from "@/server/config-store";
import { journal } from "@/server/log";

export type LdapInfo = { email: string | null; display_name: string | null };

export function ldapEnabled(cfg: AppSettings): boolean {
  return Boolean(cfg.LDAP_ENABLED && cfg.LDAP_SERVER);
}

type Serveur = { url: string; ssl: boolean; port: number; options: ClientOptions };

/** Construit les options du client ldapts avec gestion LDAPS (TLS). */
export function buildServer(cfg: AppSettings): Serveur {
  let raw = (cfg.LDAP_SERVER || "").trim();
  const low = raw.toLowerCase();
  let schemeSsl: boolean | null = null;
  if (low.startsWith("ldaps://")) {
    schemeSsl = true;
    raw = raw.slice(8);
  } else if (low.startsWith("ldap://")) {
    schemeSsl = false;
    raw = raw.slice(7);
  }
  const host = raw.replace(/\/+$/, "").trim();
  const useSsl = Boolean(cfg.LDAP_USE_SSL) || schemeSsl === true;
  let port = Number(cfg.LDAP_PORT) || (useSsl ? 636 : 389);
  if (useSsl && port === 389) port = 636;
  const url = `${useSsl ? "ldaps" : "ldap"}://${host}:${port}`;
  const options: ClientOptions = { url, timeout: 8000, connectTimeout: 8000 };
  if (useSsl) {
    const tls: Record<string, unknown> = { rejectUnauthorized: cfg.LDAP_VALIDATE_CERT !== false };
    if (cfg.LDAP_CA_CERT) {
      try {
        tls.ca = [readFileSync(cfg.LDAP_CA_CERT)];
      } catch (e) {
        journal.avert("ldap", "Certificat CA illisible", { chemin: cfg.LDAP_CA_CERT, erreur: e });
      }
    }
    options.tlsOptions = tls;
  }
  return { url, ssl: useSsl, port, options };
}

/** Teste la connexion LDAP (et le bind du compte de service si renseigné). */
export async function testLdapConnection(cfg: AppSettings): Promise<[boolean, string]> {
  if (!cfg.LDAP_ENABLED)
    return [false, "LDAP désactivé : activez-le puis enregistrez avant de tester."];
  if (!cfg.LDAP_SERVER) return [false, "Aucun serveur LDAP configuré."];
  const bindUser = cfg.LDAP_BIND_USER;
  const bindPw = cfg.LDAP_BIND_PASSWORD;
  try {
    const server = buildServer(cfg);
    const proto = server.ssl
      ? `LDAPS (TLS, port ${server.port}, ${cfg.LDAP_VALIDATE_CERT !== false ? "certificat validé" : "certificat non validé"})`
      : `LDAP non chiffré (port ${server.port})`;
    const client = new Client(server.options);
    try {
      if (bindUser && bindPw) {
        await client.bind(bindUser, bindPw);
        if (cfg.LDAP_BASE_DN) {
          await client.search(cfg.LDAP_BASE_DN, { scope: "base", filter: "(objectClass=*)" });
        }
        return [
          true,
          `Connexion et authentification réussies via ${proto} (compte de service : ${bindUser}).`,
        ];
      }
      await client.bind("", "");
      return [
        true,
        `Connexion au serveur LDAP réussie via ${proto} (aucun compte de service configuré).`,
      ];
    } finally {
      await client.unbind().catch(() => {});
    }
  } catch (e) {
    return [false, `Échec de connexion LDAP : ${e instanceof Error ? e.message : String(e)}`];
  }
}

/** Échappe une valeur pour un filtre LDAP (RFC 4515). */
export function esc(v: string | null | undefined): string {
  let out = v ?? "";
  for (const [ch, rep] of [
    ["\\", "\\5c"],
    ["(", "\\28"],
    [")", "\\29"],
    ["*", "\\2a"],
    ["\x00", "\\00"],
  ] as const) {
    out = out.split(ch).join(rep);
  }
  return out;
}

function attr(entry: Record<string, unknown>, name: string): string {
  const v = entry[name];
  if (Array.isArray(v)) return v.length ? String(v[0]) : "";
  if (v === undefined || v === null) return "";
  return String(v);
}

function attrs(entry: Record<string, unknown>, name: string): string[] {
  const v = entry[name];
  if (Array.isArray(v)) return v.map(String);
  if (v === undefined || v === null) return [];
  return [String(v)];
}

/** Vrai si l'utilisateur appartient au groupe AD (groupes imbriqués inclus). */
async function userInGroup(
  client: Client,
  base: string,
  username: string,
  group: string,
): Promise<boolean> {
  const g = (group || "").trim();
  if (!g) return true;
  let groupDn = g;
  try {
    if (!g.includes("=")) {
      const r = await client.search(base, {
        filter: `(&(objectClass=group)(|(cn=${esc(g)})(sAMAccountName=${esc(g)})))`,
        attributes: ["cn"],
      });
      if (!r.searchEntries.length) return false;
      groupDn = String(r.searchEntries[0].dn);
    }
    const r1 = await client.search(base, {
      filter: `(&(sAMAccountName=${esc(username)})(memberOf:1.2.840.113556.1.4.1941:=${groupDn}))`,
      attributes: ["cn"],
    });
    if (r1.searchEntries.length) return true;
    const r2 = await client.search(base, {
      filter: `(sAMAccountName=${esc(username)})`,
      attributes: ["memberOf"],
    });
    if (r2.searchEntries.length) {
      const mof = attrs(r2.searchEntries[0] as Record<string, unknown>, "memberOf").map((x) =>
        x.toLowerCase(),
      );
      return mof.includes(groupDn.toLowerCase());
    }
  } catch (e) {
    journal.info("ldap", "Vérif groupe LDAP échouée", { username, erreur: e });
    return false;
  }
  return false;
}

/** Tente un bind LDAP. Retourne les infos (succès) ou null (échec / désactivé). */
export async function ldapAuthenticate(
  cfg: AppSettings,
  username: string,
  password: string,
): Promise<LdapInfo | null> {
  // Mode test : un annuaire simulé, réglé en base (« user:mdp,user2:mdp2 »), pour les
  // tests d'intégration qui jouaient `monkeypatch` sur ldap_authenticate.
  if (process.env.SENTINELLE_TEST) {
    const accepte = String(cfg.SENTINELLE_TEST_LDAP_ACCEPT ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (accepte.length)
      return accepte.includes(`${username}:${password}`)
        ? { email: null, display_name: null }
        : null;
  }
  if (!ldapEnabled(cfg) || !username || !password) return null;
  const domain = cfg.LDAP_DOMAIN || "";
  const template = cfg.LDAP_USER_DN_TEMPLATE || "";
  let bindUser: string;
  if (template) bindUser = template.replace("{username}", username);
  else if (domain) bindUser = `${username}@${domain}`;
  else bindUser = username;

  const server = buildServer(cfg);
  const client = new Client(server.options);
  try {
    await client.bind(bindUser, password);
  } catch (e) {
    journal.info("ldap", "Échec bind LDAP", { username, erreur: e });
    await client.unbind().catch(() => {});
    return null;
  }
  try {
    const base = cfg.LDAP_BASE_DN;
    const requiredGroup = (cfg.LDAP_REQUIRED_GROUP || "").trim();
    if (requiredGroup) {
      if (!base) {
        journal.avert("ldap", "LDAP_REQUIRED_GROUP défini mais LDAP_BASE_DN vide : accès refusé", {
          username,
        });
        return null;
      }
      if (!(await userInGroup(client, base, username, requiredGroup))) {
        journal.info("ldap", "Accès LDAP refusé : pas membre du groupe", {
          username,
          requiredGroup,
        });
        return null;
      }
    }
    const info: LdapInfo = { email: null, display_name: null };
    if (base) {
      try {
        const r = await client.search(base, {
          filter: `(sAMAccountName=${esc(username)})`,
          attributes: ["mail", "displayName"],
        });
        if (r.searchEntries.length) {
          const entry = r.searchEntries[0] as Record<string, unknown>;
          info.email = attr(entry, "mail") || null;
          info.display_name = attr(entry, "displayName") || null;
        }
      } catch {
        // la recherche d'attributs est facultative
      }
    }
    return info;
  } finally {
    await client.unbind().catch(() => {});
  }
}

/** Vrai si la recherche annuaire est possible (LDAP actif + compte de service + Base DN). */
export function directorySearchAvailable(cfg: AppSettings): boolean {
  return Boolean(ldapEnabled(cfg) && cfg.LDAP_BIND_USER && cfg.LDAP_BASE_DN);
}

export type Personne = { display_name: string; email: string; username: string };

/** Recherche des personnes dans l'AD via le compte de service. [] en repli. */
export async function searchDirectory(
  cfg: AppSettings,
  query: string,
  limit = 10,
): Promise<Personne[]> {
  const q = (query || "").trim();
  if (q.length < 2 || !directorySearchAvailable(cfg)) return [];
  const client = new Client(buildServer(cfg).options);
  try {
    await client.bind(cfg.LDAP_BIND_USER, cfg.LDAP_BIND_PASSWORD);
  } catch (e) {
    journal.info("ldap", "Recherche annuaire : connexion AD impossible", { erreur: e });
    return [];
  }
  const term = esc(q);
  const filt =
    "(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2))" +
    `(|(displayName=*${term}*)(sAMAccountName=*${term}*)(mail=*${term}*)(cn=*${term}*)))`;
  const out: Personne[] = [];
  try {
    const r = await client.search(cfg.LDAP_BASE_DN, {
      filter: filt,
      attributes: ["displayName", "mail", "sAMAccountName", "cn"],
      sizeLimit: Math.max(1, Math.min(limit, 50)),
    });
    for (const e of r.searchEntries as Record<string, unknown>[]) {
      const email = attr(e, "mail");
      const name = attr(e, "displayName") || attr(e, "cn");
      const uname = attr(e, "sAMAccountName");
      if (!(name || email)) continue;
      out.push({ display_name: name, email, username: uname });
    }
  } catch (e) {
    journal.info("ldap", "Recherche annuaire échouée", { erreur: e });
  } finally {
    await client.unbind().catch(() => {});
  }
  out.sort((a, b) => {
    const ea = a.email === "" ? 1 : 0;
    const eb = b.email === "" ? 1 : 0;
    if (ea !== eb) return ea - eb;
    return a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase());
  });
  return out.slice(0, limit);
}

// FILETIME Windows → date (100 ns depuis 1601-01-01 UTC)
const FILETIME_NEVER = new Set(["0", "9223372036854775807"]);

export function filetimeToDate(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  if (FILETIME_NEVER.has(s)) return null;
  const big = BigInt(s);
  const ms = Number(big / 10000n) - 11644473600000;
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Met à jour next_password_change des comptes dont le username correspond à un
 * compte AD, d'après msDS-UserPasswordExpiryTimeComputed. Retourne (màj, erreurs).
 */
export async function syncPasswordExpirations(cfg: AppSettings): Promise<[number, string[]]> {
  const { prisma } = await import("@/server/db");
  if (!ldapEnabled(cfg) || !cfg.LDAP_BIND_USER || !cfg.LDAP_BASE_DN) {
    return [0, ["LDAP/compte de service/Base DN non configures"]];
  }
  const client = new Client(buildServer(cfg).options);
  try {
    await client.bind(cfg.LDAP_BIND_USER, cfg.LDAP_BIND_PASSWORD);
  } catch (e) {
    return [0, [`Connexion AD impossible : ${e instanceof Error ? e.message : String(e)}`]];
  }
  let updated = 0;
  const errors: string[] = [];
  try {
    const comptes = await prisma.account.findMany({ where: { isActive: true } });
    for (const acc of comptes) {
      const uname = (acc.username || "").trim();
      if (!uname) continue;
      try {
        const r = await client.search(cfg.LDAP_BASE_DN, {
          filter: `(sAMAccountName=${esc(uname)})`,
          attributes: ["msDS-UserPasswordExpiryTimeComputed"],
        });
        if (!r.searchEntries.length) continue;
        const raw = attr(
          r.searchEntries[0] as Record<string, unknown>,
          "msDS-UserPasswordExpiryTimeComputed",
        );
        const expiry = filetimeToDate(raw);
        if (
          expiry &&
          (!acc.nextPasswordChange || expiry.getTime() !== acc.nextPasswordChange.getTime())
        ) {
          const { dateCourte } = await import("@/lib/libelles");
          await prisma.account.update({
            where: { id: acc.id },
            data: { nextPasswordChange: expiry },
          });
          await prisma.accountHistory.create({
            data: {
              accountId: acc.id,
              action: "ad_sync",
              comment: `Expiration synchronisee depuis AD : ${dateCourte(expiry)}`,
              performedBy: "auto-ad",
            },
          });
          updated += 1;
        }
      } catch (e) {
        errors.push(`${uname}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } finally {
    await client.unbind().catch(() => {});
  }
  return [updated, errors];
}
