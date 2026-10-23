/**
 * Export total de secours (port de app/full_export.py) : archive ZIP à mettre sur clé USB.
 *
 * Contient : la base (dump PostgreSQL, restauration par pg_restore), les CSV de chaque
 * domaine (réexploitables), les pièces jointes en fichiers (dossier documents/, lisibles
 * sans rien restaurer), une page HTML de consultation (lisible hors-ligne, sans
 * l'application) et un LISEZMOI. L'archive s'écrit dans un FICHIER temporaire, la base et
 * les pièces jointes y entrent depuis le disque : le coût d'un export ne dépend pas de ce
 * qu'on a mis dedans.
 *
 * `sansDocuments` retire les OCTETS des pièces jointes (ni dans la base, ni en fichiers) :
 * les fiches restent, leur contenu non.
 *
 * Un dump impossible (pg_dump absent, base injoignable) ne bloque pas l'archive : elle part
 * sans la base, avec base/ABSENTE.txt qui dit pourquoi.
 */
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import archiver from "archiver";
import { exportCsv, SPECS } from "@/server/csv-io";
import { prisma } from "@/server/db";
import { dumpVers } from "@/server/db-backup";
import { escapeHtml } from "@/server/mailer";

const LABELS: Record<string, string> = {
  accounts: "Comptes",
  certificates: "Certificats",
  domains: "Domaines",
  backups: "Sauvegardes",
  tests: "Tests",
  reviews: "Revue de droits",
  updates: "Mises à jour",
};

async function htmlSnapshot(): Promise<string> {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const horodatage = `${p(now.getUTCDate())}/${p(now.getUTCMonth() + 1)}/${now.getUTCFullYear()} ${p(now.getUTCHours())}:${p(now.getUTCMinutes())} UTC`;
  const blocks: string[] = [];
  for (const [key, spec] of Object.entries(SPECS)) {
    const csv = await exportCsv(key);
    const lignes = csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);
    const [, ...rows] = lignes;
    const head = spec.columns.map((c) => `<th>${escapeHtml(c.csv)}</th>`).join("");
    let body = rows
      .map(
        (l) =>
          `<tr>${decoupe(l)
            .map((cell) => `<td>${escapeHtml(cell)}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    if (!rows.length)
      body = `<tr><td colspan="${spec.columns.length}" class="muted">Aucun</td></tr>`;
    blocks.push(
      `<h2>${escapeHtml(LABELS[key] ?? key)} <span class="muted">(${rows.length})</span></h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
    );
  }
  return (
    '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Sentinelle — export de consultation</title><style>' +
    "body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#1e293b;}" +
    "h1{color:#4f46e5;} h2{margin-top:28px;border-bottom:2px solid #e2e8f0;padding-bottom:4px;}" +
    "table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px;}" +
    "th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;}" +
    "th{background:#f1f5f9;} .muted{color:#94a3b8;font-weight:normal;}" +
    "</style></head><body>" +
    "<h1>&#128737; Sentinelle — Export de consultation</h1>" +
    `<p class="muted">Genere le ${horodatage}. Donnees actives uniquement.</p>${blocks.join("")}</body></html>`
  );
}

/** Une ligne CSV (séparateur ';', guillemets) en cellules. */
function decoupe(ligne: string): string[] {
  const out: string[] = [];
  let champ = "";
  let g = false;
  for (let i = 0; i < ligne.length; i++) {
    const ch = ligne[i];
    if (g) {
      if (ch === '"' && ligne[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (ch === '"') g = false;
      else champ += ch;
    } else if (ch === '"') g = true;
    else if (ch === ";") {
      out.push(champ);
      champ = "";
    } else champ += ch;
  }
  out.push(champ);
  return out;
}

const README = `SENTINELLE — EXPORT TOTAL DE SECOURS
=====================================

Contenu de cette archive :

  consultation.html   Page consultable dans un navigateur, SANS l'application
                      ni la base (a ouvrir directement). Vue d'ensemble des
                      comptes, certificats, domaines, backups et tests.

  csv/                Les donnees au format CSV (Excel / LibreOffice),
                      reimportables dans Sentinelle (bouton CSV des listes).

  documents/          Les pieces jointes, un fichier par piece, nomme
                      <id>_<nom du fichier> (l'id est celui de la fiche
                      Document, pour la retrouver dans la base ou les CSV).
                      Absent d'une archive ALLEGEE.

  base/sentinelle.dump  Copie complete de la base PostgreSQL (format pg_dump
                      « custom »). Pour restaurer : arreter Sentinelle, puis
                      pg_restore --clean --if-exists --no-owner -d <DATABASE_URL> base/sentinelle.dump
                      et redemarrer.
                      ATTENTION : dans une archive ALLEGEE, cette base ne
                      contient pas les octets des pieces jointes. Leurs fiches
                      sont la, les telechargements repondraient 404.
                      Si le dump n'a pas pu etre fait, base/ABSENTE.txt en
                      donne la raison : l'archive n'a alors que les CSV, les
                      pieces jointes et la page de consultation.

A conserver sur un support hors-ligne (cle USB) en cas de crash ou d'attaque.
Ce fichier contient des informations sensibles : le proteger.
`;

const PREFIXE = "sentinelle-export-";
const PEREMPTION_MS = 3600_000;

/** Supprime les répertoires de travail abandonnés (un export interrompu ne doit pas remplir le disque). */
async function balayerRestes(): Promise<void> {
  const racine = os.tmpdir();
  let entrees: string[];
  try {
    entrees = await fs.readdir(racine);
  } catch {
    return;
  }
  const limite = Date.now() - PEREMPTION_MS;
  for (const nom of entrees) {
    if (!nom.startsWith(PREFIXE)) continue;
    const chemin = path.join(racine, nom);
    try {
      const st = await fs.stat(chemin);
      if (st.isDirectory() && st.mtimeMs < limite)
        await fs.rm(chemin, { recursive: true, force: true });
    } catch {
      // Un reste qu'on n'arrive pas à lire attendra le prochain passage.
    }
  }
}

/** Un nom de fichier sûr dans l'archive : ni séparateur, ni caractère interdit. */
function nomSur(filename: string): string {
  const nom = Array.from(filename, (c) => (c.charCodeAt(0) < 32 ? "_" : c))
    .join("")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  return nom || "document";
}

/**
 * Écrit chaque pièce jointe dans `dossier` (un fichier par document, `<id>_<nom>`), lue
 * une par une pour ne pas charger tous les octets en mémoire. Retourne (chemin, nom dans
 * l'archive) pour chacune.
 */
async function ecrireDocuments(dossier: string): Promise<[string, string][]> {
  const docs = await prisma.document.findMany({
    where: { content: { isNot: null } },
    select: { id: true, filename: true },
    orderBy: { id: "asc" },
  });
  if (!docs.length) return [];
  await fs.mkdir(dossier, { recursive: true });
  const out: [string, string][] = [];
  for (const d of docs) {
    const contenu = await prisma.documentContent.findUnique({
      where: { documentId: d.id },
      select: { data: true },
    });
    if (!contenu) continue;
    const nom = `${d.id}_${nomSur(d.filename)}`;
    const chemin = path.join(dossier, nom);
    await fs.writeFile(chemin, contenu.data);
    out.push([chemin, `documents/${nom}`]);
  }
  return out;
}

/** Construit l'archive et retourne (nom du fichier, chemin du zip temporaire). L'appelant l'envoie puis supprime son répertoire. */
export async function buildFullExport(sansDocuments = false): Promise<[string, string]> {
  await balayerRestes();
  const travail = await fs.mkdtemp(path.join(os.tmpdir(), PREFIXE));
  const baseCopie = path.join(travail, "sentinelle.dump");
  const zipPath = path.join(travail, "archive.zip");
  try {
    let baseAbsente: string | null = null;
    try {
      await dumpVers(baseCopie, { sansDocuments });
    } catch (e) {
      console.error("[export] dump de la base impossible, archive sans la base :", e);
      baseAbsente = e instanceof Error ? e.message : String(e);
    }
    const documents = sansDocuments ? [] : await ecrireDocuments(path.join(travail, "documents"));
    await new Promise<void>((resolve, reject) => {
      const sortie = createWriteStream(zipPath);
      const zip = archiver("zip", { zlib: { level: 6 } });
      sortie.on("close", () => resolve());
      zip.on("error", reject);
      zip.pipe(sortie);
      (async () => {
        for (const key of Object.keys(SPECS))
          zip.append(await exportCsv(key), { name: `csv/${key}.csv` });
        if (baseAbsente === null) zip.file(baseCopie, { name: "base/sentinelle.dump" });
        else
          zip.append(
            `La copie de la base n'a pas pu etre faite : ${baseAbsente}\n\n` +
              "Cette archive ne contient que les CSV, les pieces jointes et la page de\n" +
              "consultation. Verifier pg_dump (variable PG_DUMP_BIN) et refaire l'export.\n",
            { name: "base/ABSENTE.txt" },
          );
        for (const [chemin, nom] of documents) zip.file(chemin, { name: nom });
        zip.append(await htmlSnapshot(), { name: "consultation.html" });
        zip.append(README, { name: "LISEZMOI.txt" });
        await zip.finalize();
      })().catch(reject);
    });
  } catch (e) {
    await fs.rm(travail, { recursive: true, force: true });
    throw e;
  } finally {
    await fs.rm(baseCopie, { force: true });
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
  return [`sentinelle-export-${stamp}${sansDocuments ? "-sans-documents" : ""}.zip`, zipPath];
}
