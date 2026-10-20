/**
 * Sauvegarde de la base (port de app/db_backup.py, PostgreSQL au lieu de SQLite).
 *
 * `pg_dump` au format « custom » (restaurable par `pg_restore`), horodaté, avec
 * rotation : on garde les BACKUP_DB_KEEP plus récents. Le binaire se règle par
 * PG_DUMP_BIN (défaut : `pg_dump` du PATH, celui du paquet postgresql-client).
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppSettings } from "@/server/config-store";
import { prisma } from "@/server/db";

const BACKUP_NAME_RE = /^sentinelle_\d{8}_\d{6}\.dump$/;

export type BackupInfo = { name: string; sizeKb: number; date: Date };

export function backupDir(cfg: AppSettings): string {
  return cfg.BACKUP_DB_DIR || path.join(process.cwd(), "instance", "db_backups");
}

/** Liste des sauvegardes existantes, plus récentes d'abord. */
export async function listBackups(cfg: AppSettings): Promise<BackupInfo[]> {
  const directory = backupDir(cfg);
  let noms: string[];
  try {
    noms = await fs.readdir(directory);
  } catch {
    return [];
  }
  const infos: BackupInfo[] = [];
  for (const nom of noms
    .filter((n) => BACKUP_NAME_RE.test(n))
    .sort()
    .reverse()) {
    const st = await fs.stat(path.join(directory, nom));
    infos.push({ name: nom, sizeKb: Math.round((st.size / 1024) * 10) / 10, date: st.mtime });
  }
  return infos;
}

/** Taille de la base, en méga-octets : chiffre ce que coûte la rétention. */
export async function dbSizeMb(): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<
      { size: bigint | number }[]
    >`SELECT pg_database_size(current_database()) AS size`;
    const octets = Number(rows[0]?.size ?? 0);
    return Math.round((octets / (1024 * 1024)) * 10) / 10;
  } catch {
    return 0;
  }
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
}

/**
 * Écrit un dump de la base dans `dest`. `sansDocuments` retire les OCTETS des
 * pièces jointes (table document_content) : les fiches restent, leur contenu non.
 */
export async function dumpVers(
  dest: string,
  opts: { sansDocuments?: boolean } = {},
): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL absent : impossible de sauvegarder la base.");
  const [bin, ...prefixe] = (process.env.PG_DUMP_BIN || "pg_dump").split(/\s+/).filter(Boolean);
  const args = [...prefixe, "--format=custom", "--no-owner", "--no-privileges"];
  if (opts.sansDocuments) args.push("--exclude-table-data=document_content");
  args.push("--dbname", url);
  await new Promise<void>((resolve, reject) => {
    const sortie = createWriteStream(dest);
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let erreur = "";
    proc.on("error", (e) =>
      reject(new Error(`pg_dump introuvable ou injoignable (${bin}) : ${e.message}`)),
    );
    proc.stderr.on("data", (d) => {
      erreur += String(d);
    });
    proc.stdout.pipe(sortie);
    proc.on("close", (code) => {
      sortie.end(() => {
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `pg_dump a échoué (code ${code}) : ${erreur.trim().split("\n").at(-1) ?? ""}`,
            ),
          );
      });
    });
  });
}

/** Crée une sauvegarde horodatée et applique la rotation. Retourne le chemin. */
export async function backupDatabase(cfg: AppSettings): Promise<string> {
  const directory = backupDir(cfg);
  await fs.mkdir(directory, { recursive: true });
  const dest = path.join(directory, `sentinelle_${stamp()}.dump`);
  try {
    await dumpVers(dest);
  } catch (e) {
    await fs.rm(dest, { force: true });
    throw e;
  }
  await rotate(cfg, directory);
  return dest;
}

/** Supprime une sauvegarde par son nom (garde anti-traversée). */
export async function deleteBackup(cfg: AppSettings, name: string): Promise<void> {
  if (!name || !BACKUP_NAME_RE.test(name)) throw new Error("Nom de sauvegarde invalide");
  const directory = path.resolve(backupDir(cfg));
  const chemin = path.resolve(directory, name);
  if (path.dirname(chemin) !== directory) throw new Error("Chemin invalide");
  try {
    await fs.access(chemin);
  } catch {
    throw new Error("Sauvegarde introuvable");
  }
  await fs.unlink(chemin);
}

export async function rotate(cfg: AppSettings, directory: string): Promise<void> {
  const keep = Number(cfg.BACKUP_DB_KEEP) || 14;
  const noms = (await fs.readdir(directory))
    .filter((n) => BACKUP_NAME_RE.test(n))
    .sort()
    .reverse();
  for (const vieux of noms.slice(keep)) {
    await fs.rm(path.join(directory, vieux), { force: true });
  }
}
