/** Corbeille : éléments désactivés (is_active=false) restaurables par catégorie (port de app/trash.py). */
import { prisma } from "@/server/db";
import type { CurrentUser } from "@/server/guards";
import { clearSnooze } from "@/server/snooze";

type Spec = {
  cat: string;
  label: string;
  nom: (o: Record<string, unknown>) => string;
  lire: (where: { isActive: boolean; id?: number }) => Promise<Record<string, unknown>[]>;
  activer: (id: number) => Promise<unknown>;
  supprimer: (id: number) => Promise<unknown>;
  historique: ((id: number, performedBy: string) => Promise<unknown>) | null;
};

const s = (o: Record<string, unknown>, k: string) => String(o[k] ?? "");

export const SPECS: Record<string, Spec> = {
  account: {
    cat: "accounts",
    label: "Comptes",
    nom: (o) => `${s(o, "serviceName")} (${s(o, "username")})`,
    lire: (where) => prisma.account.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.account.update({ where: { id }, data: { isActive: true } }),
    supprimer: (id) => prisma.account.delete({ where: { id } }),
    historique: (id, performedBy) => prisma.accountHistory.create({ data: { accountId: id, action: "restored", comment: "Restaure depuis la corbeille", performedBy } }),
  },
  certificate: {
    cat: "certificates",
    label: "Certificats",
    nom: (o) => `${s(o, "serviceName")} - ${o.domain ?? "None"}`,
    lire: (where) => prisma.certificate.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.certificate.update({ where: { id }, data: { isActive: true } }),
    supprimer: (id) => prisma.certificate.delete({ where: { id } }),
    historique: (id, performedBy) => prisma.certificateHistory.create({ data: { certificateId: id, action: "restored", comment: "Restaure depuis la corbeille", performedBy } }),
  },
  domain: {
    cat: "domains",
    label: "Domaines",
    nom: (o) => s(o, "name"),
    lire: (where) => prisma.domain.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.domain.update({ where: { id }, data: { isActive: true } }),
    supprimer: (id) => prisma.domain.delete({ where: { id } }),
    historique: (id, performedBy) => prisma.domainHistory.create({ data: { domainId: id, action: "restored", comment: "Restaure depuis la corbeille", performedBy } }),
  },
  backup: {
    cat: "backups",
    label: "Sauvegardes",
    nom: (o) => s(o, "serviceName"),
    lire: (where) => prisma.backup.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.backup.update({ where: { id }, data: { isActive: true } }),
    supprimer: (id) => prisma.backup.delete({ where: { id } }),
    historique: (id, performedBy) => prisma.backupHistory.create({ data: { backupId: id, action: "restored", comment: "Restaure depuis la corbeille", performedBy } }),
  },
  test: {
    cat: "tests",
    label: "Tests",
    nom: (o) => s(o, "name"),
    lire: (where) => prisma.testTask.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.testTask.update({ where: { id }, data: { isActive: true } }),
    supprimer: (id) => prisma.testTask.delete({ where: { id } }),
    historique: (id, performedBy) => prisma.testHistory.create({ data: { testId: id, action: "restored", comment: "Restaure depuis la corbeille", performedBy } }),
  },
  review: {
    cat: "reviews",
    label: "Revue de droits",
    nom: (o) => s(o, "application"),
    lire: (where) => prisma.accessReview.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.accessReview.update({ where: { id }, data: { isActive: true } }),
    supprimer: (id) => prisma.accessReview.delete({ where: { id } }),
    historique: (id, performedBy) => prisma.reviewHistory.create({ data: { reviewId: id, action: "restored", comment: "Restaure depuis la corbeille", performedBy } }),
  },
  update: {
    cat: "updates",
    label: "Mises à jour",
    nom: (o) => s(o, "name"),
    lire: (where) => prisma.systemUpdate.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.systemUpdate.update({ where: { id }, data: { isActive: true } }),
    supprimer: (id) => prisma.systemUpdate.delete({ where: { id } }),
    historique: (id, performedBy) => prisma.updateHistory.create({ data: { updateId: id, action: "restored", comment: "Restaure depuis la corbeille", performedBy } }),
  },
  equipment: {
    cat: "inventory",
    label: "Matériel",
    nom: (o) => s(o, "name"),
    lire: (where) => prisma.equipment.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.equipment.update({ where: { id }, data: { isActive: true } }),
    supprimer: async (id) => {
      // Détache explicitement les éléments liés (vue 360°) avant la suppression.
      await prisma.certificate.updateMany({ where: { equipmentId: id }, data: { equipmentId: null } });
      await prisma.backup.updateMany({ where: { equipmentId: id }, data: { equipmentId: null } });
      await prisma.systemUpdate.updateMany({ where: { equipmentId: id }, data: { equipmentId: null } });
      await prisma.account.updateMany({ where: { equipmentId: id }, data: { equipmentId: null } });
      await prisma.contractEquipment.deleteMany({ where: { equipmentId: id } });
      await prisma.softwareEquipment.deleteMany({ where: { equipmentId: id } });
      return prisma.equipment.delete({ where: { id } });
    },
    historique: null,
  },
  contract: {
    cat: "contracts",
    label: "Contrats",
    nom: (o) => s(o, "name"),
    lire: (where) => prisma.contract.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.contract.update({ where: { id }, data: { isActive: true } }),
    supprimer: (id) => prisma.contract.delete({ where: { id } }),
    historique: (id, performedBy) => prisma.contractHistory.create({ data: { contractId: id, action: "restored", comment: "Restaure depuis la corbeille", performedBy } }),
  },
  supplier: {
    cat: "suppliers",
    label: "Fournisseurs",
    nom: (o) => s(o, "name"),
    lire: (where) => prisma.supplier.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.supplier.update({ where: { id }, data: { isActive: true } }),
    supprimer: async (id) => {
      await prisma.equipment.updateMany({ where: { supplierId: id }, data: { supplierId: null } });
      await prisma.contract.updateMany({ where: { supplierId: id }, data: { supplierId: null } });
      await prisma.certificate.updateMany({ where: { supplierId: id }, data: { supplierId: null } });
      await prisma.account.updateMany({ where: { supplierId: id }, data: { supplierId: null } });
      await prisma.domain.updateMany({ where: { registrarId: id }, data: { registrarId: null } });
      return prisma.supplier.delete({ where: { id } });
    },
    historique: null,
  },
  software: {
    cat: "software",
    label: "Logiciels",
    nom: (o) => s(o, "name"),
    lire: (where) => prisma.software.findMany({ where, orderBy: { updatedAt: "desc" } }),
    activer: (id) => prisma.software.update({ where: { id }, data: { isActive: true } }),
    supprimer: async (id) => {
      await prisma.systemUpdate.updateMany({ where: { softwareId: id }, data: { softwareId: null } });
      await prisma.accessReview.updateMany({ where: { softwareId: id }, data: { softwareId: null } });
      await prisma.account.updateMany({ where: { softwareId: id }, data: { softwareId: null } });
      return prisma.software.delete({ where: { id } });
    },
    historique: null,
  },
};

export type Groupe = { etype: string; label: string; canPurge: boolean; items: { id: number; name: string; date: Date | null }[] };

/** Groupes d'éléments supprimés pour les catégories que l'utilisateur peut éditer. */
export async function listTrashed(user: CurrentUser): Promise<Groupe[]> {
  const groups: Groupe[] = [];
  for (const [etype, spec] of Object.entries(SPECS)) {
    if (!user.canEdit(spec.cat)) continue;
    const items = await spec.lire({ isActive: false });
    if (items.length) {
      groups.push({ etype, label: spec.label, canPurge: user.canDelete(spec.cat), items: items.map((o) => ({ id: Number(o.id), name: spec.nom(o), date: (o.updatedAt as Date) ?? null })) });
    }
  }
  return groups;
}

async function purgeObj(etype: string, spec: Spec, id: number): Promise<void> {
  await clearSnooze(etype, id);
  if (etype === "domain") await prisma.certificate.updateMany({ where: { domainId: id }, data: { domainId: null } });
  await spec.supprimer(id);
}

/** Suppression définitive d'un élément. Retourne (libellé, nom) ou null. */
export async function purgeOne(user: CurrentUser, etype: string, entityId: string): Promise<[string, string] | null> {
  const spec = SPECS[etype];
  if (!spec || !/^\d+$/.test(entityId) || !user.canDelete(spec.cat)) return null;
  const [obj] = await spec.lire({ isActive: false, id: Number.parseInt(entityId, 10) });
  if (!obj) return null;
  const name = spec.nom(obj);
  await purgeObj(etype, spec, Number(obj.id));
  return [spec.label, name];
}

/** Supprime définitivement tout ce qui est en corbeille dans les catégories où l'utilisateur a le droit de suppression. */
export async function purgeAll(user: CurrentUser): Promise<number> {
  let total = 0;
  for (const [etype, spec] of Object.entries(SPECS)) {
    if (!user.canDelete(spec.cat)) continue;
    for (const obj of await spec.lire({ isActive: false })) {
      await purgeObj(etype, spec, Number(obj.id));
      total += 1;
    }
  }
  return total;
}

/** Restaure un élément. Retourne (libellé, nom) ou null. */
export async function restore(user: CurrentUser, etype: string, entityId: string, performedBy: string): Promise<[string, string] | null> {
  const spec = SPECS[etype];
  if (!spec || !/^\d+$/.test(entityId) || !user.canEdit(spec.cat)) return null;
  const [obj] = await spec.lire({ isActive: false, id: Number.parseInt(entityId, 10) });
  if (!obj) return null;
  await spec.activer(Number(obj.id));
  if (spec.historique) await spec.historique(Number(obj.id), performedBy);
  return [spec.label, spec.nom(obj)];
}
