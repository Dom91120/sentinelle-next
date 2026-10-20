/** Les quatre fiches exportables en PDF (port de app/pdf_export.py). */
import { dateCourte } from "@/lib/libelles";
import { prisma } from "@/server/db";
import {
  chargerCertificats,
  chargerComptes,
  chargerDomaines,
  chargerTests,
} from "@/server/donnees";
import type { CurrentUser } from "@/server/guards";
import { ApiAuthError } from "@/server/guards";
import { construirePdfFiche } from "@/server/pdf-entite";

const tiret = (v: string | null | undefined) => v || "—";
const date = (d: Date | null | undefined) => (d ? dateCourte(d) : "—");

export type FichePdf = { octets: Buffer; filename: string } | null;

export async function pdfCompte(user: CurrentUser, id: number): Promise<FichePdf> {
  if (!user.canView("accounts")) throw new ApiAuthError(403, "Droits insuffisants.");
  const account = (await chargerComptes()).find((a) => a.id === id) ?? null;
  if (!account) return null;
  const histories = await prisma.accountHistory.findMany({
    where: { accountId: id },
    orderBy: { performedAt: "desc" },
    take: 20,
  });
  const rows: [string, string][] = [
    ["Service", account.serviceName],
    ["Utilisateur", account.username],
    ["URL", tiret(account.url)],
    ["Dernier changement", date(account.lastPasswordChange)],
    ["Prochain changement", date(account.nextPasswordChange)],
    ["Description", tiret(account.description)],
  ];
  return {
    octets: await construirePdfFiche(
      account.serviceName,
      account.username,
      rows,
      account.status,
      histories,
    ),
    filename: `compte-${account.id}.pdf`,
  };
}

export async function pdfCertificat(user: CurrentUser, id: number): Promise<FichePdf> {
  if (!user.canView("certificates")) throw new ApiAuthError(403, "Droits insuffisants.");
  const cert = (await chargerCertificats()).find((c) => c.id === id) ?? null;
  if (!cert) return null;
  const histories = await prisma.certificateHistory.findMany({
    where: { certificateId: id },
    orderBy: { performedAt: "desc" },
    take: 20,
  });
  const rows: [string, string][] = [
    ["Service", cert.serviceName],
    ["Domaine", cert.domain ?? ""],
    ["Émetteur", tiret(cert.issuer)],
    ["Expiration", date(cert.expiryDate)],
    ["Auto-renouvellement", cert.autoRenew ? "Oui" : "Non"],
    ["Description", tiret(cert.description)],
  ];
  return {
    octets: await construirePdfFiche(
      cert.serviceName,
      cert.domain ?? "",
      rows,
      cert.status,
      histories,
    ),
    filename: `certificat-${cert.id}.pdf`,
  };
}

export async function pdfDomaine(user: CurrentUser, id: number): Promise<FichePdf> {
  if (!user.canView("domains")) throw new ApiAuthError(403, "Droits insuffisants.");
  const domain = (await chargerDomaines()).find((d) => d.id === id) ?? null;
  if (!domain) return null;
  const histories = await prisma.domainHistory.findMany({
    where: { domainId: id },
    orderBy: { performedAt: "desc" },
    take: 20,
  });
  const rows: [string, string][] = [
    ["Domaine", domain.name],
    ["Registrar", tiret(domain.registrar)],
    ["Expiration", date(domain.expiryDate)],
    ["Renouvellement auto", domain.autoRenew ? "Oui" : "Non"],
    ["Description", tiret(domain.description)],
  ];
  return {
    octets: await construirePdfFiche(
      domain.name,
      domain.registrar || "",
      rows,
      domain.status,
      histories,
    ),
    filename: `domaine-${domain.id}.pdf`,
  };
}

export async function pdfTest(user: CurrentUser, id: number): Promise<FichePdf> {
  if (!user.canView("tests")) throw new ApiAuthError(403, "Droits insuffisants.");
  const test = (await chargerTests()).find((t) => t.id === id) ?? null;
  if (!test) return null;
  const brut = await prisma.testTask.findUnique({ where: { id }, select: { status: true } });
  const histories = await prisma.testHistory.findMany({
    where: { testId: id },
    orderBy: { performedAt: "desc" },
    take: 20,
  });
  const rows: [string, string][] = [
    ["Nom", test.name],
    ["Type", tiret(test.testType)],
    ["Dernier test", date(test.lastPerformed)],
    ["Prochain test", date(test.nextDue)],
    ["Fréquence", test.frequencyDays ? `${test.frequencyDays} jour(s)` : "—"],
    ["Statut", tiret(brut?.status)],
    ["Description", tiret(test.description)],
  ];
  return {
    octets: await construirePdfFiche(test.name, test.testType || "", rows, test.status, histories),
    filename: `test-${test.id}.pdf`,
  };
}
