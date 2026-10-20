/** Recherche globale (port de app/search.py). */
import { dateCourte, tailleLabel } from "@/lib/libelles";
import { equipmentComputedStatus, softwareComputedStatus, updateStatusColor } from "@/lib/statuts";
import { hostingLabel } from "@/modules/software/server";
import { prisma } from "@/server/db";
import { documentsEnabled } from "@/server/documents";
import { chargerCycles, lookupDans } from "@/server/eol";
import { enabledIn } from "@/server/features";
import type { CurrentUser } from "@/server/guards";

export type Resultat = {
  type: string;
  icon: string;
  label: string;
  detail: string;
  url: string;
  badge: string;
  perm?: string;
};

const CAT_PERM: Record<string, string> = {
  account: "accounts",
  certificate: "certificates",
  backup: "backups",
  test: "tests",
  domaine: "domains",
  revue: "reviews",
  "mise à jour": "updates",
  inventaire: "inventory",
  fournisseur: "suppliers",
  contrat: "contracts",
  logiciel: "software",
  devis: "contracts",
};

type Mode = { contains: string; mode: "insensitive" };

export async function rechercher(q: string, user: CurrentUser): Promise<Resultat[]> {
  const results: Resultat[] = [];
  if (q && q.length >= 2) {
    const like: Mode = { contains: q, mode: "insensitive" };

    for (const a of await prisma.account.findMany({
      where: {
        isActive: true,
        OR: [{ serviceName: like }, { username: like }, { url: like }, { description: like }],
      },
    })) {
      results.push({
        type: "account",
        icon: "bi-key",
        label: `${a.serviceName} (${a.username})`,
        detail: "Compte MDP",
        url: `/accounts/${a.id}`,
        badge: "info",
      });
    }
    for (const c of await prisma.certificate.findMany({
      where: {
        isActive: true,
        OR: [{ serviceName: like }, { domain: like }, { issuer: like }, { description: like }],
      },
    })) {
      results.push({
        type: "certificate",
        icon: "bi-award",
        label: `${c.serviceName} - ${c.domain}`,
        detail: c.expiryDate
          ? `Certificat - expire ${dateCourte(c.expiryDate)}`
          : "Certificat - echeance a completer",
        url: `/certificates/${c.id}`,
        badge: "success",
      });
    }
    for (const b of await prisma.backup.findMany({
      where: {
        isActive: true,
        OR: [{ serviceName: like }, { location: like }, { description: like }],
      },
    })) {
      results.push({
        type: "backup",
        icon: "bi-cloud-arrow-up",
        label: b.serviceName,
        detail: `Backup - ${b.backupType ?? ""}`,
        url: `/backups/${b.id}`,
        badge: "warning",
      });
    }
    for (const t of await prisma.testTask.findMany({
      where: { isActive: true, OR: [{ name: like }, { description: like }, { testType: like }] },
    })) {
      results.push({
        type: "test",
        icon: "bi-clipboard-check",
        label: t.name,
        detail: `Test - ${t.testType}`,
        url: `/tests/${t.id}`,
        badge: "info",
      });
    }
    for (const d of await prisma.domain.findMany({
      where: { isActive: true, OR: [{ name: like }, { registrar: like }, { description: like }] },
    })) {
      results.push({
        type: "domaine",
        icon: "bi-globe",
        label: d.name,
        detail: `Domaine - ${d.registrar ?? ""}`,
        url: `/domains/${d.id}`,
        badge: "info",
      });
    }
    for (const r of await prisma.accessReview.findMany({
      where: {
        isActive: true,
        OR: [{ application: like }, { responsible: like }, { scope: like }],
      },
    })) {
      results.push({
        type: "revue",
        icon: "bi-person-check",
        label: r.application,
        detail: `Revue de droits${r.responsible ? ` - ${r.responsible}` : ""}`,
        url: `/reviews/${r.id}`,
        badge: "warning",
      });
    }
    for (const u of await prisma.systemUpdate.findMany({
      where: {
        isActive: true,
        OR: [
          { name: like },
          { currentVersion: like },
          { latestVersion: like },
          { updatedBy: like },
          { description: like },
        ],
      },
    })) {
      results.push({
        type: "mise à jour",
        icon: "bi-arrow-up-circle",
        label: u.name,
        detail: `MàJ - ${u.currentVersion ?? "?"}`,
        url: `/updates/${u.id}`,
        badge: updateStatusColor(u),
      });
    }
    const equipments = await prisma.equipment.findMany({
      where: {
        isActive: true,
        OR: [
          { name: like },
          { os: like },
          { ipAddress: like },
          { hostServer: like },
          { serialNumber: like },
          { serviceTag: like },
          { location: like },
          { managementUrl: like },
          { manufacturerModel: like },
          { rolePrincipal: like },
          { observations: like },
        ],
      },
    });
    if (equipments.length) {
      const [cycles, backups] = await Promise.all([
        chargerCycles(),
        prisma.backup.findMany({
          where: { isActive: true, equipmentId: { in: equipments.map((e) => e.id) } },
          select: { equipmentId: true },
        }),
      ]);
      const avecBackup = new Set(backups.map((b) => b.equipmentId));
      for (const e of equipments) {
        const eol = lookupDans(cycles, e.os, e.osVersion);
        results.push({
          type: "inventaire",
          icon: "bi-hdd-stack",
          label: e.name,
          detail: `Matériel - ${[e.os, e.ipAddress].filter(Boolean).join(" · ")}`,
          url: `/inventory/${e.id}`,
          badge: equipmentComputedStatus(e, {
            hasActiveBackup: avecBackup.has(e.id),
            eol,
            osStaleDays: user.settings.OS_STALE_DAYS,
          }),
        });
      }
    }
    for (const s of await prisma.supplier.findMany({
      where: {
        isActive: true,
        OR: [
          { name: like },
          { contactName: like },
          { email: like },
          { customerRef: like },
          { city: like },
          { commercialContact: like },
          { adminContact: like },
          { notes: like },
        ],
      },
    })) {
      results.push({
        type: "fournisseur",
        icon: "bi-building",
        label: s.name,
        detail: `Fournisseur${s.contactName ? ` - ${s.contactName}` : ""}`,
        url: `/suppliers/${s.id}`,
        badge: "info",
      });
    }
    for (const c of await prisma.contract.findMany({
      where: { isActive: true, OR: [{ name: like }, { reference: like }, { description: like }] },
      include: { supplier: true },
    })) {
      results.push({
        type: "contrat",
        icon: "bi-file-earmark-text",
        label: c.name,
        detail: `Contrat${c.supplier ? ` - ${c.supplier.name}` : ""}${c.endDate ? ` - échéance ${dateCourte(c.endDate)}` : ""}`,
        url: `/contracts/${c.id}`,
        badge: "info",
      });
    }
    for (const s of await prisma.software.findMany({
      where: {
        isActive: true,
        OR: [
          { name: like },
          { version: like },
          { responsible: like },
          { techResponsible: like },
          { description: like },
        ],
      },
      include: { supplier: true, systemUpdates: { where: { isActive: true } } },
    })) {
      const editeur = s.supplier ? ` - ${s.supplier.name}` : "";
      results.push({
        type: "logiciel",
        icon: "bi-window-stack",
        label: `${s.name}${s.version ? ` ${s.version}` : ""}`,
        detail: `Logiciel - ${hostingLabel(s)}${editeur}`,
        url: `/inventory/logiciels/${s.id}`,
        badge: softwareComputedStatus(s, s.systemUpdates),
      });
    }
    if (enabledIn(user.settings, "quotes")) {
      const quotes = await prisma.quote.findMany({
        where: {
          consultation: { software: { isActive: true } },
          OR: [
            { supplierName: like },
            { notes: like },
            { supplier: { name: like } },
            { consultation: { subject: like } },
          ],
        },
        include: { supplier: true, consultation: { include: { software: true } } },
      });
      for (const qt of quotes) {
        const who = qt.supplier ? qt.supplier.name : qt.supplierName || "—";
        const montant =
          qt.amount !== null
            ? ` - ${Math.round(qt.amount)
                .toString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`
            : "";
        results.push({
          type: "devis",
          icon: "bi-cash-coin",
          label: `${who}${montant}`,
          detail: `Devis - ${qt.consultation.software.name} - ${qt.consultation.subject}`,
          url: `/inventory/logiciels/${qt.consultation.softwareId}#devis`,
          badge: qt.selected ? "success" : "info",
        });
      }
    }
    if (documentsEnabled(user.settings)) {
      const docs = await prisma.document.findMany({
        where: { OR: [{ filename: like }, { category: { label: like } }] },
        include: {
          category: true,
          software: true,
          contract: true,
          supplier: true,
          certificate: true,
          equipment: true,
          quote: { include: { consultation: { include: { software: true } } } },
        },
      });
      for (const d of docs) {
        const target = cibleDocument(d);
        if (!target) continue;
        results.push({
          type: "pièce jointe",
          icon: "bi-paperclip",
          label: d.filename,
          detail: `${d.category ? d.category.label : "Pièce jointe"} - ${target[0]} - ${tailleLabel(d.size)}`,
          url: target[1],
          badge: "info",
          perm: target[2],
        });
      }
    }
  }
  return results.filter((r) => user.canView(r.perm ?? CAT_PERM[r.type]));
}

type DocCible = {
  softwareId: number | null;
  contractId: number | null;
  quoteId: number | null;
  supplierId: number | null;
  certificateId: number | null;
  equipmentId: number | null;
  software: { name: string; isActive: boolean; id: number } | null;
  contract: { name: string; isActive: boolean; id: number } | null;
  supplier: { name: string; isActive: boolean; id: number } | null;
  certificate: { serviceName: string; isActive: boolean; id: number } | null;
  equipment: { name: string; isActive: boolean; id: number } | null;
  quote: {
    supplierName: string | null;
    consultation: { software: { name: string; isActive: boolean; id: number } };
  } | null;
};

/** La fiche qui porte une pièce jointe : (libellé, url, catégorie de droits), ou null si orpheline / en corbeille. */
function cibleDocument(d: DocCible): [string, string, string] | null {
  if (d.softwareId) {
    if (d.software?.isActive)
      return [
        `Logiciel ${d.software.name}`,
        `/inventory/logiciels/${d.software.id}#documents`,
        "software",
      ];
  } else if (d.contractId) {
    if (d.contract?.isActive)
      return [`Contrat ${d.contract.name}`, `/contracts/${d.contract.id}#documents`, "contracts"];
  } else if (d.quoteId) {
    const sw = d.quote?.consultation.software;
    if (sw?.isActive)
      return [
        `Devis ${d.quote?.supplierName || "—"} (${sw.name})`,
        `/inventory/logiciels/${sw.id}#devis`,
        "contracts",
      ];
  } else if (d.supplierId) {
    if (d.supplier?.isActive)
      return [
        `Fournisseur ${d.supplier.name}`,
        `/suppliers/${d.supplier.id}#documents`,
        "suppliers",
      ];
  } else if (d.certificateId) {
    if (d.certificate?.isActive)
      return [
        `Certificat ${d.certificate.serviceName}`,
        `/certificates/${d.certificate.id}#documents`,
        "certificates",
      ];
  } else if (d.equipmentId) {
    if (d.equipment?.isActive)
      return [`Matériel ${d.equipment.name}`, `/inventory/${d.equipment.id}`, "inventory"];
  }
  return null;
}
