/**
 * Les gestes sur une pièce jointe (port des routes de app/documents.py) : dépôt, fichier
 * apporté après coup, modification, suppression, téléchargement, aperçu.
 */
import type { Document } from "@/generated/prisma/client";
import { DOCUMENT_PARENTS } from "@/lib/constantes";
import { champ, parseDate, parseInt_ } from "@/lib/forms-util";
import { auditRecord } from "@/server/audit";
import { prisma } from "@/server/db";
import {
  documentsEnabled,
  extension,
  hasFile,
  INLINE_TYPES,
  inlineViewEnabled,
  lireFichier,
  nomAffiche,
  parentId,
  parentKind,
  permissionCategoryOf,
  retour,
} from "@/server/documents";
import type { CurrentUser } from "@/server/guards";
import { pasTrouve, redirection, redirigerAvecMessage } from "@/server/http";

/**
 * La page où revenir : celle d'où le geste est parti quand le formulaire le dit (`next`,
 * un chemin relatif seulement), sinon la fiche qui porte la pièce.
 */
async function suite(form: FormData, kind: string | null, pid: number | null): Promise<string> {
  const suivant = champ(form, "next");
  if (suivant.startsWith("/") && !suivant.startsWith("//")) return suivant;
  return kind ? retour(kind, pid) : "/";
}

export async function deposer(user: CurrentUser, form: FormData): Promise<Response> {
  if (!documentsEnabled(user.settings)) return pasTrouve();
  const kind = champ(form, "parent_kind");
  const pid = parseInt_(form.get("parent_id"));
  if (!(kind in DOCUMENT_PARENTS) || !pid) return new Response("Bad Request", { status: 400 });
  const [col, categorie] = DOCUMENT_PARENTS[kind];
  const ou = await suite(form, kind, pid);
  // Déposer une pièce, c'est modifier la fiche : même droit.
  if (!user.canEdit(categorie))
    return redirigerAvecMessage(
      ou,
      "Vous n'avez pas les droits pour déposer une pièce ici.",
      "danger",
    );
  const lu = await lireFichier(user.settings, form.get("file"));
  if (typeof lu === "string") return redirigerAvecMessage(ou, lu, "danger");
  // Le nom se choisit dès le dépôt ; sans rien de saisi, la pièce prend celui du fichier.
  const nom = nomAffiche(form.get("filename")) || lu.nom;
  await prisma.document.create({
    data: {
      filename: nom,
      mime: lu.mime,
      size: lu.octets.length,
      uploadedBy: user.username,
      categoryId: parseInt_(form.get("category_id")),
      docDate: parseDate(form.get("doc_date")),
      [col]: pid,
      content: { create: { data: new Uint8Array(lu.octets) } },
    },
  });
  await auditRecord("depot piece jointe", `${nom} (${kind} #${pid})`, categorie, user.username);
  return redirigerAvecMessage(ou, "Pièce jointe ajoutée", "success");
}

async function charger(
  id: number,
): Promise<(Document & { content: { documentId: number } | null }) | null> {
  return prisma.document.findUnique({
    where: { id },
    include: { content: { select: { documentId: true } } },
  });
}

/** Apporte son fichier à une pièce qui n'en a pas : une pièce de marché reprise sans son acte. */
export async function apporterFichier(
  user: CurrentUser,
  id: number,
  form: FormData,
): Promise<Response> {
  if (!documentsEnabled(user.settings)) return pasTrouve();
  const doc = await charger(id);
  if (!doc) return pasTrouve();
  const categorie = permissionCategoryOf(doc);
  const kind = parentKind(doc);
  const pid = parentId(doc);
  const ou = await retour(kind, pid);
  if (!user.canEdit(categorie))
    return redirigerAvecMessage(
      ou,
      "Vous n'avez pas les droits pour déposer une pièce ici.",
      "danger",
    );
  if (hasFile(doc)) return redirigerAvecMessage(ou, "Cette pièce a déjà son fichier.", "warning");
  const lu = await lireFichier(user.settings, form.get("file"));
  if (typeof lu === "string") return redirigerAvecMessage(ou, lu, "danger");
  await prisma.$transaction([
    prisma.documentContent.deleteMany({ where: { documentId: id } }),
    prisma.document.update({
      where: { id },
      data: {
        mime: lu.mime,
        size: lu.octets.length,
        uploadedBy: user.username,
        content: { create: { data: new Uint8Array(lu.octets) } },
      },
    }),
  ]);
  await auditRecord(
    "fichier apporte a une piece",
    `${lu.nom} (${kind} #${pid})`,
    categorie,
    user.username,
  );
  return redirigerAvecMessage(ou, "Fichier déposé", "success");
}

/** Corrige une pièce : son nom, son fichier (remplacé, ou apporté s'il manquait), sa catégorie, sa date. */
export async function modifier(user: CurrentUser, id: number, form: FormData): Promise<Response> {
  if (!documentsEnabled(user.settings)) return pasTrouve();
  const doc = await charger(id);
  if (!doc) return pasTrouve();
  const categorie = permissionCategoryOf(doc);
  const kind = parentKind(doc);
  const pid = parentId(doc);
  const ou = await suite(form, kind, pid);
  if (!user.canEdit(categorie))
    return redirigerAvecMessage(
      ou,
      "Vous n'avez pas les droits pour modifier cette pièce.",
      "danger",
    );

  const data: Record<string, unknown> = {};
  const fichier = form.get("file");
  if (fichier && typeof fichier !== "string" && (fichier.name || "").trim()) {
    const lu = await lireFichier(user.settings, fichier);
    if (typeof lu === "string") return redirigerAvecMessage(ou, lu, "danger");
    await prisma.documentContent.deleteMany({ where: { documentId: id } });
    data.content = { create: { data: new Uint8Array(lu.octets) } };
    data.mime = lu.mime;
    data.size = lu.octets.length;
    data.uploadedBy = user.username;
    // Sans nom choisi, la pièce prend celui du nouveau fichier.
    if (!champ(form, "filename")) data.filename = lu.nom;
  }
  const nom = nomAffiche(form.get("filename"));
  if (nom) data.filename = nom;
  data.categoryId = parseInt_(form.get("category_id"));
  data.docDate = parseDate(form.get("doc_date"));
  const maj = await prisma.document.update({ where: { id }, data });
  await auditRecord("modification piece jointe", maj.filename, categorie, user.username);
  return redirigerAvecMessage(ou, "Pièce modifiée", "success");
}

export async function supprimer(user: CurrentUser, id: number, req: Request): Promise<Response> {
  if (!documentsEnabled(user.settings)) return pasTrouve();
  const doc = await charger(id);
  if (!doc) return pasTrouve();
  const categorie = permissionCategoryOf(doc);
  if (!user.canDelete(categorie)) {
    const r = req.headers.get("referer");
    return redirigerAvecMessage(
      r ? new URL(r).pathname : "/",
      "Vous n'avez pas les droits pour retirer cette pièce.",
      "danger",
    );
  }
  const kind = parentKind(doc);
  const pid = parentId(doc);
  await prisma.document.delete({ where: { id } }); // le contenu suit (cascade)
  await auditRecord("suppression piece jointe", doc.filename, categorie, user.username);
  return redirigerAvecMessage(await retour(kind, pid), "Pièce jointe supprimée", "success");
}

async function contenu(id: number): Promise<{ doc: Document; data: Uint8Array } | null> {
  const doc = await prisma.document.findUnique({ where: { id }, include: { content: true } });
  if (!doc || !hasFile(doc) || !doc.content) return null;
  return { doc, data: doc.content.data };
}

function nomAttache(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** TOUJOURS en pièce jointe, et jamais avec le type annoncé par le déposant. */
export async function telecharger(user: CurrentUser, id: number): Promise<Response> {
  if (!documentsEnabled(user.settings)) return pasTrouve();
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return pasTrouve();
  if (!user.canView(permissionCategoryOf(doc))) return new Response("Forbidden", { status: 403 });
  const c = await contenu(id);
  if (!c) return pasTrouve();
  return new Response(new Uint8Array(c.data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; ${nomAttache(c.doc.filename)}`,
      "Content-Length": String(c.data.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Rend la pièce telle quelle, pour un onglet dédié, quand son type s'y prête (PDF, images matricielles). */
export async function voir(user: CurrentUser, id: number): Promise<Response> {
  if (!inlineViewEnabled(user.settings)) return pasTrouve();
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return pasTrouve();
  if (!user.canView(permissionCategoryOf(doc))) return new Response("Forbidden", { status: 403 });
  const mime = INLINE_TYPES[extension(doc.filename || "")];
  const c = mime ? await contenu(id) : null;
  if (!mime || !c) return pasTrouve();
  return new Response(new Uint8Array(c.data), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; ${nomAttache(c.doc.filename)}`,
      "Content-Length": String(c.data.byteLength),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; object-src 'self'; frame-ancestors 'none'",
    },
  });
}

export { redirection };
