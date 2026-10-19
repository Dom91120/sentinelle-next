/**
 * Amorçage et petites migrations de données (port de _seed_roles, _migrate_roles,
 * _seed_referentials, _migrate_contract_kinds, _migrate_certificate_lists,
 * _migrate_referential_scopes, _seed_default_user, _migrate_data et
 * config_store.seed_from_env de app/__init__.py).
 *
 * Appelé par `pnpm db:init` et, de façon idempotente, au démarrage du serveur
 * (instrumentation.ts).
 */
import { randomBytes } from "node:crypto";
import {
  CERT_SUPPORT_LABELS,
  CERT_USAGE_LABELS,
  CONTRACT_KIND_LABELS,
  PERMISSION_CATEGORIES,
  PERMISSION_INHERITANCE,
  REFERENTIAL_SEED_SCOPES,
  REFERENTIAL_SEEDS,
} from "@/lib/constantes";
import { domainForHost } from "@/lib/statuts";
import { seedFromEnv } from "@/server/config-store";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/password";

/** Un droit nouveau-né hérite du droit qu'il remplace (une seule fois). */
export async function migrateRoles(): Promise<void> {
  for (const role of await prisma.role.findMany({ where: { isAdmin: false } })) {
    const perms = { ...((role.permissions as Record<string, number> | null) ?? {}) };
    let changed = false;
    for (const [nouveau, source] of Object.entries(PERMISSION_INHERITANCE)) {
      if (!(nouveau in perms) && source in perms) {
        perms[nouveau] = perms[source];
        changed = true;
      }
    }
    if (changed) await prisma.role.update({ where: { id: role.id }, data: { permissions: perms } });
  }
}

export async function seedRoles(): Promise<void> {
  const editorLevel = (c: string) => (c === "alerts" ? 1 : 3);
  const viewerLevel = () => 1;
  const defaults: Record<string, { description: string; isAdmin: boolean; level: ((c: string) => number) | null }> = {
    admin: { description: "Acces total", isAdmin: true, level: null },
    editor: { description: "Gestion des donnees", isAdmin: false, level: editorLevel },
    viewer: { description: "Lecture seule", isAdmin: false, level: viewerLevel },
  };
  for (const [name, cfg] of Object.entries(defaults)) {
    const role = await prisma.role.findUnique({ where: { name } });
    if (!role) {
      const perms = cfg.level ? Object.fromEntries(PERMISSION_CATEGORIES.map((c) => [c, cfg.level?.(c)])) : {};
      await prisma.role.create({ data: { name, description: cfg.description, isAdmin: cfg.isAdmin, permissions: perms } });
    } else if (!role.isAdmin && cfg.level) {
      const perms = { ...((role.permissions as Record<string, number> | null) ?? {}) };
      let missing = false;
      for (const c of PERMISSION_CATEGORIES) {
        if (!(c in perms)) {
          perms[c] = cfg.level(c);
          missing = true;
        }
      }
      if (missing) await prisma.role.update({ where: { id: role.id }, data: { permissions: perms } });
    }
  }
}

/** Verse les valeurs de départ des listes administrables, seulement si la liste est entièrement vide. */
export async function seedReferentials(): Promise<void> {
  for (const [kind, labels] of Object.entries(REFERENTIAL_SEEDS)) {
    const existe = await prisma.referential.findFirst({ where: { kind }, select: { id: true } });
    if (existe) continue;
    const portees = REFERENTIAL_SEED_SCOPES[kind] ?? {};
    await prisma.referential.createMany({
      data: labels.map((label, i) => ({ kind, label, position: i, scope: portees[label] ?? null })),
    });
  }
}

async function refParLibelle(kind: string): Promise<Map<string, number>> {
  const rows = await prisma.referential.findMany({ where: { kind } });
  return new Map(rows.map((r) => [r.label, r.id]));
}

async function refOuCreer(kind: string, label: string, cache: Map<string, number>): Promise<number> {
  const existant = cache.get(label);
  if (existant) return existant;
  const r = await prisma.referential.create({ data: { kind, label, position: cache.size } });
  cache.set(label, r.id);
  return r.id;
}

/** Ancien type de contrat (colonne `kind`) → `kind_id`, sans toucher un lien posé. */
export async function migrateContractKinds(): Promise<void> {
  const a = await prisma.contract.findMany({ where: { kindId: null, kind: { not: null } } });
  if (!a.length) return;
  const cache = await refParLibelle("contract_kind");
  for (const c of a) {
    const libelle = CONTRACT_KIND_LABELS[c.kind ?? ""];
    if (!libelle) continue;
    const id = await refOuCreer("contract_kind", libelle, cache);
    await prisma.contract.update({ where: { id: c.id }, data: { kindId: id } });
  }
}

/** Ancien usage / support d'un certificat → usage_id / support_id. */
export async function migrateCertificateLists(): Promise<void> {
  const usages = await prisma.certificate.findMany({ where: { usageId: null, certUsageCode: { not: null } } });
  if (usages.length) {
    const cache = await refParLibelle("cert_usage");
    for (const c of usages) {
      const libelle = CERT_USAGE_LABELS[c.certUsageCode ?? ""];
      if (!libelle) continue;
      await prisma.certificate.update({ where: { id: c.id }, data: { usageId: await refOuCreer("cert_usage", libelle, cache) } });
    }
  }
  const supports = await prisma.certificate.findMany({ where: { supportId: null, supportCode: { not: null } } });
  if (supports.length) {
    const cache = await refParLibelle("cert_support");
    for (const c of supports) {
      const libelle = CERT_SUPPORT_LABELS[c.supportCode ?? ""];
      if (!libelle) continue;
      await prisma.certificate.update({ where: { id: c.id }, data: { supportId: await refOuCreer("cert_support", libelle, cache) } });
    }
  }
}

/** Donne leur portée de départ aux valeurs semées avant que la portée existe. */
export async function migrateReferentialScopes(): Promise<void> {
  for (const [kind, portees] of Object.entries(REFERENTIAL_SEED_SCOPES)) {
    for (const r of await prisma.referential.findMany({ where: { kind, scope: null } })) {
      if (r.label in portees) await prisma.referential.update({ where: { id: r.id }, data: { scope: portees[r.label] } });
    }
  }
}

/** Petites migrations de données idempotentes (rapprochements par nom → liens). */
export async function migrateData(): Promise<void> {
  await prisma.$executeRaw`UPDATE software SET hosting='on_premise' WHERE hosting IS NULL OR hosting=''`;
  await prisma.$executeRaw`UPDATE software SET lifecycle='production' WHERE lifecycle IS NULL OR lifecycle=''`;
  await prisma.$executeRaw`UPDATE certificate SET kind='tls' WHERE kind IS NULL OR kind=''`;
  await prisma.$executeRaw`UPDATE certificate SET validity='valide' WHERE validity IS NULL OR validity=''`;
  await prisma.$executeRaw`DELETE FROM app_config WHERE key IN ('SOFTINVENTORY_URL', 'SOFTINVENTORY_KEY', 'INVENTORY_API_ENABLED', 'INVENTORY_API_TOKEN')`;
  // Certificats TLS sans lien : rattachés au domaine enregistré dont ils relèvent.
  const domaines = await prisma.domain.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  for (const c of await prisma.certificate.findMany({ where: { kind: "tls", domainId: null, domain: { not: null } } })) {
    const d = domainForHost(c.domain, domaines);
    if (d) await prisma.certificate.update({ where: { id: c.id }, data: { domainId: d.id } });
  }
  // Comptes : le nom du service rejoint la fiche logiciel / équipement du même nom (unique).
  for (const [table, col] of [
    ["software", "software_id"],
    ["equipment", "equipment_id"],
  ] as const) {
    await prisma.$executeRawUnsafe(
      `UPDATE account SET ${col} = (SELECT t.id FROM ${table} t WHERE lower(t.name) = lower(account.service_name) AND t.is_active = true)` +
        ` WHERE software_id IS NULL AND equipment_id IS NULL AND supplier_id IS NULL AND (` +
        `SELECT COUNT(*) FROM ${table} t2 WHERE lower(t2.name) = lower(account.service_name) AND t2.is_active = true) = 1`,
    );
  }
  await prisma.$executeRaw`UPDATE domain SET registrar_id = (SELECT s.id FROM supplier s WHERE lower(s.name) = lower(domain.registrar) AND s.is_active = true)
    WHERE registrar_id IS NULL AND registrar IS NOT NULL AND (SELECT COUNT(*) FROM supplier s2 WHERE lower(s2.name) = lower(domain.registrar) AND s2.is_active = true) = 1`;
  await prisma.$executeRaw`UPDATE access_review SET software_id = (SELECT s.id FROM software s WHERE lower(s.name) = lower(access_review.application) AND s.is_active = true)
    WHERE software_id IS NULL AND (SELECT COUNT(*) FROM software s2 WHERE lower(s2.name) = lower(access_review.application) AND s2.is_active = true) = 1`;
  for (const [table, col] of [
    ["software", "software_id"],
    ["equipment", "equipment_id"],
  ] as const) {
    await prisma.$executeRawUnsafe(
      `UPDATE system_update SET ${col} = (SELECT t.id FROM ${table} t WHERE lower(t.name) = lower(system_update.name) AND t.is_active = true)` +
        ` WHERE software_id IS NULL AND equipment_id IS NULL AND (` +
        `SELECT COUNT(*) FROM ${table} t2 WHERE lower(t2.name) = lower(system_update.name) AND t2.is_active = true) = 1`,
    );
  }
}

function annoncer(password: string, created: boolean): void {
  const action = created ? "cree" : "reinitialise (mot de passe par defaut detecte)";
  console.log(`\n${"=".repeat(64)}`);
  console.log(`  COMPTE ADMIN ${action}`);
  console.log("  Identifiant : admin");
  console.log(`  Mot de passe: ${password}`);
  console.log("  -> Connectez-vous puis changez-le via votre profil.");
  console.log(`${"=".repeat(64)}\n`);
}

/** Crée ou met à jour l'identifiant Better Auth (table auth_account) d'un utilisateur. */
export async function poserMotDePasse(userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  const cred = await prisma.authAccount.findFirst({ where: { userId, providerId: "credential" } });
  if (cred) await prisma.authAccount.update({ where: { id: cred.id }, data: { password: hash } });
  else await prisma.authAccount.create({ data: { accountId: userId, providerId: "credential", userId, password: hash } });
}

/** Le compte « admin » : créé avec un mot de passe aléatoire, ou réinitialisé s'il vaut encore « admin ». */
export async function seedDefaultUser(opts: { annoncer?: boolean } = {}): Promise<string | null> {
  const nouveau = () => process.env.ADMIN_INITIAL_PASSWORD || randomBytes(9).toString("base64url");
  const admin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!admin) {
    const password = nouveau();
    const u = await prisma.user.create({
      data: {
        username: "admin",
        displayUsername: "admin",
        email: process.env.ADMIN_EMAIL || "admin@localhost",
        name: "admin",
        role: "admin",
        authSource: "local",
      },
    });
    await poserMotDePasse(u.id, password);
    if (opts.annoncer !== false) annoncer(password, true);
    return password;
  }
  const cred = await prisma.authAccount.findFirst({ where: { userId: admin.id, providerId: "credential" } });
  if (!cred || !cred.password || (await verifyPassword(cred.password, "admin"))) {
    const password = nouveau();
    await poserMotDePasse(admin.id, password);
    if (opts.annoncer !== false) annoncer(password, false);
    return password;
  }
  return null;
}

/** Tout l'amorçage, dans l'ordre de create_app. */
export async function amorcer(opts: { annoncer?: boolean } = {}): Promise<void> {
  await migrateData();
  await migrateRoles();
  await seedRoles();
  await seedReferentials();
  await migrateContractKinds();
  await migrateCertificateLists();
  await migrateReferentialScopes();
  await seedDefaultUser(opts);
  await seedFromEnv();
}
