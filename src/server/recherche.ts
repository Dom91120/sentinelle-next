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

/**
 * Les colonnes texte fouillées, par table, et les fiches liées dont le nom compte
 * aussi (une sous-requête EXISTS par lien). Tout est comparé via sans_accent()
 * (migration « recherche_sans_accent ») : ni la casse ni les accents ne comptent.
 * Les secrets (mots de passe, jetons, code de révocation) ne sont jamais fouillés.
 */
type Lien = { table: string; via: string; colonnes: string[]; join?: string };
type Cible = { table: string; colonnes: string[]; actif?: string; liens?: Lien[] };

const CIBLES: Record<string, Cible> = {
  account: {
    table: "account",
    colonnes: ["service_name", "username", "url", "description"],
    liens: [
      { table: "software", via: "software_id", colonnes: ["name"] },
      { table: "equipment", via: "equipment_id", colonnes: ["name"] },
      { table: "supplier", via: "supplier_id", colonnes: ["name"] },
    ],
  },
  certificate: {
    table: "certificate",
    colonnes: [
      "service_name",
      "domain",
      "issuer",
      "description",
      "holder",
      "first_name",
      "holder_role",
      "holder_email",
      "level",
      "serial_number",
      "budget_code",
    ],
    liens: [
      { table: "supplier", via: "supplier_id", colonnes: ["name"] },
      { table: "equipment", via: "equipment_id", colonnes: ["name"] },
      { table: "domain", via: "domain_id", colonnes: ["name"] },
      { table: "user_service", via: "service_id", colonnes: ["name"] },
      { table: "referential", via: "usage_id", colonnes: ["label"] },
      { table: "referential", via: "support_id", colonnes: ["label"] },
    ],
  },
  backup: {
    table: "backup",
    colonnes: [
      "service_name",
      "backup_type",
      "location",
      "frequency",
      "expected_time",
      "description",
    ],
    liens: [{ table: "equipment", via: "equipment_id", colonnes: ["name"] }],
  },
  test_task: { table: "test_task", colonnes: ["name", "test_type", "description", "result"] },
  domain: {
    table: "domain",
    colonnes: ["name", "registrar", "description"],
    liens: [{ table: "supplier", via: "registrar_id", colonnes: ["name"] }],
  },
  access_review: {
    table: "access_review",
    colonnes: ["application", "responsible", "responsible_email", "scope"],
    liens: [{ table: "software", via: "software_id", colonnes: ["name"] }],
  },
  system_update: {
    table: "system_update",
    colonnes: [
      "name",
      "system_type",
      "current_version",
      "latest_version",
      "updated_by",
      "description",
    ],
    liens: [
      { table: "software", via: "software_id", colonnes: ["name"] },
      { table: "equipment", via: "equipment_id", colonnes: ["name"] },
    ],
  },
  equipment: {
    table: "equipment",
    colonnes: [
      "name",
      "os",
      "os_version",
      "supervision",
      "ip_address",
      "vlan",
      "host_server",
      "hypervisor",
      "manufacturer_model",
      "serial_number",
      "service_tag",
      "maintenance_contract",
      "location",
      "management_url",
      "protocols",
      "role_principal",
      "business_software",
      "user_services",
      "usage",
      "pra_pca",
      "backup1",
      "backup2",
      "observations",
    ],
    liens: [
      {
        table: "software_equipment",
        via: "equipment_id",
        colonnes: ["name"],
        join: "software ON software.id = software_equipment.software_id",
      },
    ],
  },
  supplier: {
    table: "supplier",
    colonnes: [
      "name",
      "contact_name",
      "phone",
      "support_phone",
      "email",
      "support_url",
      "support_email",
      "customer_ref",
      "address",
      "postal_code",
      "city",
      "website",
      "commercial_contact",
      "commercial_phone",
      "commercial_email",
      "commercial_contact2",
      "commercial_phone2",
      "commercial_email2",
      "admin_contact",
      "admin_phone",
      "admin_email",
      "dpo_contact",
      "dpo_phone",
      "dpo_email",
      "notes",
    ],
  },
  contract: {
    table: "contract",
    colonnes: ["name", "nature", "reference", "supplier_reference", "budget_code", "description"],
    liens: [
      { table: "supplier", via: "supplier_id", colonnes: ["name"] },
      { table: "referential", via: "kind_id", colonnes: ["label"] },
      {
        table: "contract_software",
        via: "contract_id",
        colonnes: ["name"],
        join: "software ON software.id = contract_software.software_id",
      },
      {
        table: "contract_equipment",
        via: "contract_id",
        colonnes: ["name"],
        join: "equipment ON equipment.id = contract_equipment.equipment_id",
      },
    ],
  },
  software: {
    table: "software",
    colonnes: [
      "name",
      "version",
      "url",
      "responsible",
      "responsible_email",
      "tech_responsible",
      "tech_responsible_email",
      "no_contract_note",
      "gdpr_categories",
      "gdpr_registry_ref",
      "description",
    ],
    liens: [
      { table: "supplier", via: "supplier_id", colonnes: ["name"] },
      { table: "referential", via: "technology_id", colonnes: ["label"] },
      {
        table: "software_equipment",
        via: "software_id",
        colonnes: ["name"],
        join: "equipment ON equipment.id = software_equipment.equipment_id",
      },
      {
        table: "software_service",
        via: "software_id",
        colonnes: ["name"],
        join: "user_service ON user_service.id = software_service.user_service_id",
      },
      {
        table: "contract_software",
        via: "software_id",
        colonnes: ["name", "reference"],
        join: "contract ON contract.id = contract_software.contract_id",
      },
    ],
  },
  quote: {
    table: "quote",
    colonnes: ["supplier_name", "notes"],
    actif: "TRUE",
    liens: [
      { table: "supplier", via: "supplier_id", colonnes: ["name"] },
      { table: "consultation", via: "consultation_id", colonnes: ["subject", "notes"] },
    ],
  },
  document: {
    table: "document",
    colonnes: ["filename", "uploaded_by"],
    actif: "TRUE",
    liens: [{ table: "referential", via: "category_id", colonnes: ["label"] }],
  },
};

const ident = (n: string) => `"${n.replace(/"/g, "")}"`;

/** Les identifiants des lignes d'une table dont un champ texte, ou le nom d'une fiche liée, contient le terme. */
async function idsOu(cible: Cible, terme: string): Promise<number[]> {
  const t = ident(cible.table);
  const motif = `%${terme.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const clauses = cible.colonnes.map((c) => `sans_accent(${t}.${ident(c)}) LIKE $1`);
  for (const l of cible.liens ?? []) {
    const lt = ident(l.table);
    // Lien direct (clé étrangère sur la table) : la table liée porte les colonnes.
    // Lien par table de jointure : `join` nomme la table qui porte les colonnes.
    const porteur = l.join ? l.join.split(" ")[0] : lt;
    const cols = l.colonnes
      .map((c) => `sans_accent(${ident(porteur)}.${ident(c)}) LIKE $1`)
      .join(" OR ");
    clauses.push(
      l.join
        ? `EXISTS (SELECT 1 FROM ${lt} JOIN ${l.join} WHERE ${lt}.${ident(l.via)} = ${t}.id AND (${cols}))`
        : `EXISTS (SELECT 1 FROM ${lt} WHERE ${lt}.id = ${t}.${ident(l.via)} AND (${cols}))`,
    );
  }
  const actif = cible.actif ?? `${t}.is_active`;
  const sql = `SELECT ${t}.id FROM ${t} WHERE ${actif} AND (${clauses.join(" OR ")}) ORDER BY ${t}.id`;
  const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(sql, motif);
  return rows.map((r) => r.id);
}

/** Le terme tel que la base le compare : sans casse ni accents. */
function normaliser(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function rechercher(q: string, user: CurrentUser): Promise<Resultat[]> {
  const results: Resultat[] = [];
  if (q && q.length >= 2) {
    const terme = normaliser(q);
    const dans = async (cle: string) => ({ id: { in: await idsOu(CIBLES[cle], terme) } });

    for (const a of await prisma.account.findMany({
      where: { ...(await dans("account")) },
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
      where: { ...(await dans("certificate")) },
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
      where: { ...(await dans("backup")) },
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
      where: { ...(await dans("test_task")) },
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
      where: { ...(await dans("domain")) },
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
      where: { ...(await dans("access_review")) },
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
      where: { ...(await dans("system_update")) },
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
      where: { ...(await dans("equipment")) },
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
      where: { ...(await dans("supplier")) },
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
      where: { ...(await dans("contract")) },
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
      where: { ...(await dans("software")) },
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
        where: { ...(await dans("quote")), consultation: { software: { isActive: true } } },
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
        where: await dans("document"),
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
