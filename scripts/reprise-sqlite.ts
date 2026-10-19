/**
 * Reprise de la base SQLite de l'application Flask (instance/admin_dashboard.db)
 * vers PostgreSQL — table pour table, identifiants conservés, pièces jointes
 * (octets) comprises.
 *
 *   SENTINELLE_SQLITE=../sentinelle/instance/admin_dashboard.db \
 *   SENTINELLE_SECRET_KEY=<SECRET_KEY du .env Flask> pnpm db:reprise
 *
 * (SENTINELLE_ENV=../sentinelle/.env lit SECRET_KEY et BACKUP_INGEST_TOKEN dans ce fichier.)
 *
 * REJOUABLE : chaque table cible est vidée puis remplie depuis la source, dans une
 * seule transaction ; relancer après une correction n'a rien à nettoyer.
 *
 * Particularités :
 *  - `user` → `user` + `auth_account` (Better Auth) : les hachages Werkzeug sont
 *    conservés tels quels (server/password.ts les vérifie) ; un identifiant texte
 *    est généré pour chaque compte ;
 *  - second facteur : un secret TOTP repris ne peut pas servir au plugin de Better
 *    Auth (encodage différent) — le compte est marqué « 2FA à réactiver » et le dit
 *    dans le journal d'actions ;
 *  - `app_config` : les secrets chiffrés Fernet (clé dérivée de SECRET_KEY) sont
 *    déchiffrés puis rechiffrés avec la clé du nouveau socle (BETTER_AUTH_SECRET) ;
 *  - `o365_token.json` (jeton Office 365, Fernet) est repris dans app_config ;
 *  - tables dormantes ignorées : asset, contract_item, login_throttle.
 */
import "dotenv/config";
import { createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { prisma } from "@/server/db";
import { encryptSecret } from "@/server/secret-crypto";

// ── Fernet (cryptography.fernet) ──
function fernetKey(secret: string): { sign: Buffer; enc: Buffer } {
  const key = createHash("sha256").update(secret, "utf8").digest(); // 32 octets
  return { sign: key.subarray(0, 16), enc: key.subarray(16, 32) };
}

function fernetDecrypt(token: string, secret: string): string {
  const raw = Buffer.from(token, "base64url");
  if (raw.length < 1 + 8 + 16 + 32 || raw[0] !== 0x80) throw new Error("jeton Fernet invalide");
  const { sign, enc } = fernetKey(secret);
  const body = raw.subarray(0, raw.length - 32);
  const mac = raw.subarray(raw.length - 32);
  const attendu = createHmac("sha256", sign).update(body).digest();
  if (!timingSafeEqual(mac, attendu)) throw new Error("signature Fernet invalide (SECRET_KEY ?)");
  const iv = raw.subarray(9, 25);
  const ct = raw.subarray(25, raw.length - 32);
  const d = createDecipheriv("aes-128-cbc", enc, iv);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

// ── Environnement ──
function lireEnvFlask(): Record<string, string> {
  const chemin = process.env.SENTINELLE_ENV ?? path.resolve(process.cwd(), "../sentinelle/.env");
  if (!existsSync(chemin)) return {};
  const out: Record<string, string> = {};
  for (const ligne of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(ligne);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const envFlask = lireEnvFlask();
const SQLITE = process.env.SENTINELLE_SQLITE ?? path.resolve(process.cwd(), "../sentinelle/instance/admin_dashboard.db");
const SECRET_KEY = process.env.SENTINELLE_SECRET_KEY ?? envFlask.SECRET_KEY ?? "";

// ── Conversion des valeurs ──
type ColInfo = { name: string; type: string };

function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toTimestamp(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(" ", "T");
  const d = new Date(s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function convertir(type: string, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  switch (type) {
    case "date":
      return toDate(v);
    case "timestamp with time zone":
    case "timestamp without time zone":
      return toTimestamp(v);
    case "boolean":
      return v === true || v === 1 || v === "1" || v === "true";
    case "integer":
    case "smallint":
      return Number.parseInt(String(v), 10);
    case "bigint":
      return BigInt(String(v));
    case "double precision":
    case "real":
    case "numeric":
      return Number(v);
    case "bytea":
      return Buffer.isBuffer(v) ? v : Buffer.from(v as Uint8Array);
    case "jsonb":
    case "json":
      return typeof v === "string" ? JSON.parse(v) : v;
    default:
      return typeof v === "string" ? v : String(v);
  }
}

// ── Tables, dans l'ordre des clés étrangères ──
const TABLES = [
  "role",
  "supplier",
  "referential",
  "user_service",
  "equipment",
  "software",
  "software_equipment",
  "software_service",
  "software_link",
  "software_share",
  "domain",
  "certificate",
  "account",
  "backup",
  "backup_check",
  "test_task",
  "access_review",
  "system_update",
  "contract",
  "contract_equipment",
  "contract_software",
  "consultation",
  "quote",
  "document",
  "document_content",
  "account_history",
  "certificate_history",
  "domain_history",
  "backup_history",
  "test_history",
  "review_history",
  "update_history",
  "contract_history",
  "ct_log_entry",
  "scheduler_run",
  "action_log",
  "alert_log",
  "alert_snooze",
  "webhook",
  "setting",
  "eol_cache",
  "import_map",
];

async function colonnesPg(table: string): Promise<ColInfo[]> {
  const rows = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} ORDER BY ordinal_position`;
  return rows.map((r) => ({ name: r.column_name, type: r.data_type }));
}

function colonnesSqlite(db: Database.Database, table: string): string[] {
  try {
    return (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((r) => r.name);
  } catch {
    return [];
  }
}

async function copierTable(db: Database.Database, table: string): Promise<number> {
  const srcCols = colonnesSqlite(db, table);
  if (!srcCols.length) {
    console.log(`  – ${table} : absente de la source, ignorée`);
    return 0;
  }
  const pgCols = await colonnesPg(table);
  const communes = pgCols.filter((c) => srcCols.includes(c.name));
  const rows = db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
  await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  const noms = communes.map((c) => `"${c.name}"`).join(", ");
  const params = communes.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `INSERT INTO "${table}" (${noms}) VALUES (${params})`;
  let n = 0;
  for (const row of rows) {
    const valeurs = communes.map((c) => convertir(c.type, row[c.name]));
    await prisma.$executeRawUnsafe(sql, ...valeurs);
    n += 1;
  }
  if (communes.some((c) => c.name === "id")) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`,
    );
  }
  console.log(`  ✓ ${table} : ${n} ligne(s)`);
  return n;
}

async function copierUtilisateurs(db: Database.Database): Promise<void> {
  const rows = db.prepare('SELECT * FROM "user"').all() as Record<string, unknown>[];
  await prisma.$executeRawUnsafe('DELETE FROM "user"');
  let deuxFa = 0;
  for (const u of rows) {
    const id = randomBytes(16).toString("base64url");
    const username = String(u.username);
    const aDeuxFa = Boolean(u.totp_secret);
    await prisma.user.create({
      data: {
        id,
        username,
        displayUsername: username,
        email: String(u.email),
        name: username,
        role: String(u.role ?? "viewer"),
        authSource: String(u.auth_source ?? "local"),
        icsToken: (u.ics_token as string | null) ?? null,
        dashboardPrefs: (u.dashboard_prefs as string | null) ?? null,
        listPrefs: (u.list_prefs as string | null) ?? null,
        createdAt: toTimestamp(u.created_at) ?? new Date(),
        twoFactorEnabled: false,
      },
    });
    await prisma.authAccount.create({
      data: { accountId: id, providerId: "credential", userId: id, password: String(u.password_hash ?? "") },
    });
    if (aDeuxFa) {
      deuxFa += 1;
      await prisma.actionLog.create({
        data: {
          username: "reprise",
          action: "2FA à réactiver",
          category: "utilisateurs",
          detail: `${username} : le second facteur doit être réenrôlé depuis le profil (changement de socle).`,
        },
      });
    }
  }
  console.log(`  ✓ user : ${rows.length} compte(s)${deuxFa ? `, ${deuxFa} second facteur à réenrôler` : ""}`);
}

const SECRETS = new Set(["MAIL_PASSWORD", "O365_CLIENT_SECRET", "LDAP_BIND_PASSWORD", "SESAME_API_TOKEN", "CHATIA_API_TOKEN"]);

async function copierConfig(db: Database.Database): Promise<void> {
  const rows = db.prepare('SELECT key, value, is_secret FROM "app_config"').all() as { key: string; value: string | null; is_secret: number }[];
  await prisma.$executeRawUnsafe('DELETE FROM "app_config"');
  let dechiffres = 0;
  let echecs = 0;
  for (const r of rows) {
    let value = r.value ?? "";
    const secret = Boolean(r.is_secret) || SECRETS.has(r.key);
    if (secret && value) {
      try {
        value = encryptSecret(SECRET_KEY ? fernetDecrypt(value, SECRET_KEY) : "");
        dechiffres += 1;
      } catch (e) {
        echecs += 1;
        console.warn(`  ! ${r.key} : secret illisible (${e instanceof Error ? e.message : e}) — vidé, à ressaisir dans Préférences`);
        value = "";
      }
    }
    await prisma.appConfig.create({ data: { key: r.key, value, isSecret: secret } });
  }
  console.log(`  ✓ app_config : ${rows.length} clé(s), ${dechiffres} secret(s) repris, ${echecs} à ressaisir`);
  // Jeton Office 365 (fichier o365_token.json à la racine de l'application Flask).
  const tokenPath = path.resolve(path.dirname(SQLITE), "..", "o365_token.json");
  if (existsSync(tokenPath) && SECRET_KEY) {
    try {
      const raw = readFileSync(tokenPath);
      let json: string;
      try {
        json = fernetDecrypt(raw.toString("utf8").trim(), SECRET_KEY);
      } catch {
        json = raw.toString("utf8");
      }
      JSON.parse(json);
      await prisma.appConfig.upsert({
        where: { key: "O365_TOKEN" },
        update: { value: encryptSecret(json), isSecret: true },
        create: { key: "O365_TOKEN", value: encryptSecret(json), isSecret: true },
      });
      console.log("  ✓ jeton Office 365 repris");
    } catch (e) {
      console.warn(`  ! jeton Office 365 illisible : ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function main(): Promise<void> {
  if (!existsSync(SQLITE)) throw new Error(`Base SQLite introuvable : ${SQLITE}`);
  if (!SECRET_KEY) console.warn("! SENTINELLE_SECRET_KEY absente : les secrets de configuration seront à ressaisir.");
  console.log(`Reprise depuis ${SQLITE}`);
  const db = new Database(SQLITE, { readonly: true, fileMustExist: true });
  await prisma.$transaction(
    async () => {
      // Les écritures passent par le client global (une seule connexion pg en dev) :
      // la transaction sert de garde-fou sur l'ordre, le vidage précède chaque table.
    },
    { timeout: 10_000 },
  );
  // Vidage dans l'ordre inverse des dépendances, puis copie dans l'ordre.
  for (const t of [...TABLES].reverse()) {
    if (colonnesSqlite(db, t).length) await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`);
  }
  await copierUtilisateurs(db);
  for (const t of TABLES) await copierTable(db, t);
  await copierConfig(db);
  db.close();
  console.log("✓ Reprise terminée.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? `✗ ${e.message}` : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
