/** Certificats (port de app/certificates.py) : formulaire, nom de fiche, lecture TLS. */
import type { Prisma } from "@/generated/prisma/client";
import { CERT_KIND_LABELS, CERT_VALIDITY_LABELS, CIVILITY_LABELS } from "@/lib/constantes";
import {
  champ,
  champOuNull,
  coche,
  idOuNull,
  parseDate,
  parseFloat_,
  parseInt_,
} from "@/lib/forms-util";
import { dateCourte } from "@/lib/libelles";
import { domainForHost } from "@/lib/statuts";
import { fetchCertInfo } from "@/server/cert-checker";
import { prisma } from "@/server/db";

export async function formContext() {
  const [equipments, suppliers, services, usageOptions, supportOptions] = await Promise.all([
    prisma.equipment.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.userService.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    prisma.referential.findMany({
      where: { kind: "cert_usage", isActive: true },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    }),
    prisma.referential.findMany({
      where: { kind: "cert_support", isActive: true },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    }),
  ]);
  return { equipments, suppliers, services, usageOptions, supportOptions };
}

export type FormContext = Awaited<ReturnType<typeof formContext>>;

/** L'identifiant d'une valeur de référentiel, si elle existe dans CETTE liste. */
async function refId(valeur: FormDataEntryValue | null, kind: string): Promise<number | null> {
  const ident = parseInt_(valeur, null);
  if (!ident || ident <= 0) return null;
  const r = await prisma.referential.findFirst({
    where: { id: ident, kind },
    select: { id: true },
  });
  return r ? ident : null;
}

async function equipmentId(valeur: FormDataEntryValue | null): Promise<number | null> {
  const ident = parseInt_(valeur, null);
  if (!ident || ident <= 0) return null;
  const e = await prisma.equipment.findUnique({ where: { id: ident }, select: { id: true } });
  return e ? ident : null;
}

function sansAccents(texte: string | null | undefined): string {
  return (texte ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Le `service_name` d'une fiche : saisi (TLS) ou déduit du service utilisateur, à défaut du titulaire. */
async function nomDeFiche(
  kind: string,
  f: FormData,
  cert?: {
    serviceName: string;
    holder: string | null;
    firstName: string | null;
    service: { name: string } | null;
  } | null,
): Promise<string> {
  const saisi = champ(f, "service_name");
  if (saisi || kind !== "signature") return saisi;
  const serviceId = parseInt_(f.get("service_id"), null);
  const service = serviceId
    ? await prisma.userService.findUnique({ where: { id: serviceId } })
    : null;
  const titulaire = [champ(f, "holder"), champ(f, "first_name")].filter(Boolean).join(" ");
  const deduit = service ? service.name : titulaire;
  if (cert?.serviceName) {
    const anciens = new Set([
      cert.service ? sansAccents(cert.service.name) : "",
      sansAccents([cert.holder, cert.firstName].filter(Boolean).join(" ")),
    ]);
    anciens.delete("");
    if (!anciens.has(sansAccents(cert.serviceName))) return cert.serviceName;
  }
  return deduit;
}

/** L'identifiant de la fiche domaine dont relève ce nom d'hôte (TLS). */
async function domainePour(kind: string, host: string): Promise<number | null> {
  if (kind !== "tls" || !host) return null;
  const domaines = await prisma.domain.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  return domainForHost(host, domaines)?.id ?? null;
}

/** Ce qu'il faut pour que la fiche veuille dire quelque chose, selon sa nature. */
export function valide(
  kind: string,
  serviceName: string,
  domain: string,
  holder: string,
): string | null {
  if (kind === "signature") return holder ? null : "Le nom du titulaire est obligatoire.";
  if (!serviceName) return "Le nom est obligatoire.";
  if (!domain) return "Le domaine est obligatoire.";
  return null;
}

export function kindDe(valeur: unknown): string {
  return typeof valeur === "string" && valeur in CERT_KIND_LABELS ? valeur : "tls";
}

type Existant = Prisma.CertificateGetPayload<{ include: { service: true } }>;

/** Les champs d'un certificat depuis le formulaire. Retourne {erreur} ou {data}. */
export async function depuisFormulaire(
  kindDemande: string,
  f: FormData,
  cert: Existant | null,
): Promise<{ erreur: string } | { data: Prisma.CertificateUncheckedUpdateInput; kind: string }> {
  let kind = kindDemande;
  const demande = f.get("kind");
  if (cert && typeof demande === "string" && demande in CERT_KIND_LABELS) kind = demande;
  const serviceName = await nomDeFiche(kind, f, cert);
  const domain = champ(f, "domain");
  const expiryDate = parseDate(f.get("expiry_date"));
  const erreur = valide(kind, serviceName, domain, champ(f, "holder"));
  if (erreur) return { erreur };
  const validity = String(f.get("validity") ?? "");
  const data: Prisma.CertificateUncheckedUpdateInput = {
    kind,
    serviceName,
    domain: domain || null,
    domainId: await domainePour(kind, domain),
    issuer: champOuNull(f, "issuer"),
    issuedAt: parseDate(f.get("issued_at")),
    expiryDate,
    autoRenew: coche(f, "auto_renew"),
    description: typeof f.get("description") === "string" ? (f.get("description") as string) : null,
    equipmentId: await equipmentId(f.get("equipment_id")),
    supportId: await refId(f.get("support_id"), "cert_support"),
    usageId: await refId(f.get("usage_id"), "cert_usage"),
    validity: validity in CERT_VALIDITY_LABELS ? validity : "valide",
    serialNumber: champOuNull(f, "serial_number"),
  };
  if (kind === "signature") {
    data.supplierId = idOuNull(f, "supplier_id");
    data.serviceId = idOuNull(f, "service_id");
    const civ = String(f.get("civility") ?? "");
    data.civility = civ in CIVILITY_LABELS ? civ : null;
    data.holder = champOuNull(f, "holder");
    data.firstName = champOuNull(f, "first_name");
    data.holderRole = champOuNull(f, "holder_role");
    data.holderEmail = champOuNull(f, "holder_email");
    data.level = champOuNull(f, "level");
    data.durationYears = parseInt_(f.get("duration_years"), null, 0);
    data.amountTtc = parseFloat_(f.get("amount_ttc"));
    data.budgetCode = champOuNull(f, "budget_code");
    const code = champ(f, "revocation_code");
    if (code === "-") data.revocationCode = null;
    else if (code) data.revocationCode = code;
  } else {
    data.supplierId = idOuNull(f, "supplier_id");
  }
  return { data, kind };
}

/** Met à jour la fiche depuis le certificat TLS lu en direct (historique inclus). */
export async function refreshCertificateTls(
  cert: { id: number; kind: string; domain: string | null; expiryDate: Date | null },
  performedBy: string,
): Promise<[boolean, string]> {
  if ((cert.kind || "tls") !== "tls" || !cert.domain)
    return [false, "Lecture TLS impossible : ce certificat n'a pas de domaine."];
  let info: { expiryDate: Date; issuer: string | null };
  try {
    info = await fetchCertInfo(cert.domain);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.certificateHistory.create({
      data: {
        certificateId: cert.id,
        action: "tls_check_failed",
        comment: `Echec lecture TLS : ${msg}`,
        performedBy,
      },
    });
    return [false, `Verification TLS impossible : ${msg}`];
  }
  const old = cert.expiryDate;
  await prisma.certificate.update({
    where: { id: cert.id },
    data: { expiryDate: info.expiryDate, ...(info.issuer ? { issuer: info.issuer } : {}) },
  });
  let msg = `Expiration mise a jour via TLS : ${dateCourte(info.expiryDate)}`;
  if (old && old.getTime() !== info.expiryDate.getTime()) msg += ` (avant : ${dateCourte(old)})`;
  await prisma.certificateHistory.create({
    data: { certificateId: cert.id, action: "tls_check", comment: msg, performedBy },
  });
  return [true, msg];
}
