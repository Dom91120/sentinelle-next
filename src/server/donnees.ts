/**
 * Chargement des fiches actives AVEC leur statut calculé, par catégorie.
 *
 * C'est l'équivalent de `Model.query.filter_by(is_active=True).all()` suivi de
 * `.status()` / `.computed_status()` : une seule fois par objet, réutilisé par
 * le tableau de bord, les compteurs du menu, les tendances, le bilan quotidien
 * et les tâches planifiées.
 */
import type {
  AccessReview,
  Account,
  Backup,
  BackupCheck,
  Certificate,
  Contract,
  Domain,
  Equipment,
  Referential,
  Software,
  Supplier,
  SystemUpdate,
  TestTask,
} from "@/generated/prisma/client";
import type { Statut } from "@/lib/constantes";
import { aujourdhui } from "@/lib/libelles";
import {
  accountStatus,
  backupComputedStatus,
  certificateMonitored,
  certificateStatus,
  contractStatus,
  domainStatus,
  equipmentComputedStatus,
  equipmentStatusReasons,
  reviewComputedStatus,
  type Seuils,
  softwareComputedStatus,
  testComputedStatus,
  updateEffectiveStatus,
  updateStatusColor,
} from "@/lib/statuts";
import { type AppSettings, getSettings, seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import { type CyclesParProduit, chargerCycles, type EolInfo, lookupDans } from "@/server/eol";
import { categoryEnabledIn } from "@/server/features";

export type AvecStatut<T> = T & { status: Statut };

export type CertificatComplet = Certificate & {
  certUsage: Referential | null;
  support: Referential | null;
  supplier: Supplier | null;
};
export type BackupComplet = Backup & { checks: BackupCheck[] };
export type SoftwareComplet = Software & {
  systemUpdates: SystemUpdate[];
  supplier: Supplier | null;
};
export type ContratComplet = Contract & { kindRef: Referential | null; supplier: Supplier | null };
export type EquipementComplet = Equipment & {
  eol: EolInfo | null;
  hasActiveBackup: boolean;
  reasons: string[];
  supplier: Supplier | null;
};

export async function contexteStatuts(): Promise<{
  settings: AppSettings;
  seuils: Seuils;
  today: Date;
}> {
  const settings = await getSettings();
  return { settings, seuils: seuilsDe(settings), today: aujourdhui() };
}

export async function chargerComptes(seuils?: Seuils): Promise<AvecStatut<Account>[]> {
  const s = seuils ?? (await contexteStatuts()).seuils;
  const rows = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" }, // `query.filter_by(is_active=True).all()` : ordre des id
  });
  return rows.map((a) => ({ ...a, status: accountStatus(a, s) }));
}

export async function chargerCertificats(
  seuils?: Seuils,
  settings?: AppSettings,
): Promise<AvecStatut<CertificatComplet>[]> {
  const ctx = seuils && settings ? { seuils, settings } : await contexteStatuts();
  if (!categoryEnabledIn(ctx.settings, "certificates")) return [];
  const rows = await prisma.certificate.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" }, // `query.filter_by(is_active=True).all()` : ordre des id
    include: { certUsage: true, support: true, supplier: true },
  });
  return rows.map((c) => ({ ...c, status: certificateStatus(c, ctx.seuils) }));
}

/** Les certificats encore surveillés (actifs, non révoqués, datés). */
export function surveilles<T extends CertificatComplet>(certs: T[]): T[] {
  return certs.filter((c) => certificateMonitored(c));
}

export async function chargerDomaines(
  seuils?: Seuils,
): Promise<AvecStatut<Domain & { registrarSupplier: Supplier | null }>[]> {
  const s = seuils ?? (await contexteStatuts()).seuils;
  const rows = await prisma.domain.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" }, // `query.filter_by(is_active=True).all()` : ordre des id
    include: { registrarSupplier: true },
  });
  return rows.map((d) => ({ ...d, status: domainStatus(d, s) }));
}

export async function chargerSauvegardes(): Promise<AvecStatut<BackupComplet>[]> {
  const rows = await prisma.backup.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" }, // `Backup.query.filter_by(is_active=True).all()` : l'ordre d'insertion
    include: { checks: { orderBy: { checkDate: "desc" } } },
  });
  return rows.map((b) => ({ ...b, status: backupComputedStatus(b, b.checks) }));
}

export async function chargerTests(
  seuils?: Seuils,
): Promise<AvecStatut<TestTask & { software: Software | null; brut: string | null }>[]> {
  const s = seuils ?? (await contexteStatuts()).seuils;
  const rows = await prisma.testTask.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" }, // `query.filter_by(is_active=True).all()` : ordre des id
    include: { software: true },
  });
  return rows.map((t) => ({ ...t, brut: t.status, status: testComputedStatus(t, s) }));
}

export async function chargerRevues(
  seuils?: Seuils,
): Promise<AvecStatut<AccessReview & { software: Software | null; brut: string | null }>[]> {
  const s = seuils ?? (await contexteStatuts()).seuils;
  const rows = await prisma.accessReview.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" }, // `query.filter_by(is_active=True).all()` : ordre des id
    include: { software: true },
  });
  return rows.map((r) => ({ ...r, brut: r.status, status: reviewComputedStatus(r, s) }));
}

export async function chargerMisesAJour(): Promise<
  AvecStatut<
    SystemUpdate & {
      equipment: Equipment | null;
      software: Software | null;
      brut: string | null;
      effectif: string;
    }
  >[]
> {
  const rows = await prisma.systemUpdate.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" }, // `query.filter_by(is_active=True).all()` : ordre des id
    include: { equipment: true, software: true },
  });
  return rows.map((u) => ({
    ...u,
    brut: u.status,
    effectif: updateEffectiveStatus(u),
    status: updateStatusColor(u),
  }));
}

export async function chargerEquipements(
  seuils?: Seuils,
  settings?: AppSettings,
  cycles?: CyclesParProduit,
): Promise<AvecStatut<EquipementComplet>[]> {
  const ctx = seuils && settings ? { seuils, settings } : await contexteStatuts();
  const [rows, backups, cyc] = await Promise.all([
    prisma.equipment.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" }, // `query.filter_by(is_active=True).all()` : ordre des id
      include: { supplier: true },
    }),
    prisma.backup.findMany({
      where: { isActive: true, equipmentId: { not: null } },
      select: { equipmentId: true },
    }),
    cycles ? Promise.resolve(cycles) : chargerCycles(),
  ]);
  const avecBackup = new Set(backups.map((b) => b.equipmentId));
  const osStaleDays = ctx.settings.OS_STALE_DAYS;
  return rows.map((e) => {
    const eol = lookupDans(cyc, e.os, e.osVersion);
    const info = { hasActiveBackup: avecBackup.has(e.id), eol, osStaleDays };
    return {
      ...e,
      eol,
      hasActiveBackup: info.hasActiveBackup,
      reasons: equipmentStatusReasons(e, info),
      status: equipmentComputedStatus(e, info, ctx.seuils),
    };
  });
}

export async function chargerLogiciels(): Promise<AvecStatut<SoftwareComplet>[]> {
  const rows = await prisma.software.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" }, // `query.filter_by(is_active=True).all()` : ordre des id
    include: { systemUpdates: { where: { isActive: true } }, supplier: true },
  });
  return rows.map((s) => ({ ...s, status: softwareComputedStatus(s, s.systemUpdates) }));
}

export async function chargerContrats(seuils?: Seuils): Promise<AvecStatut<ContratComplet>[]> {
  const s = seuils ?? (await contexteStatuts()).seuils;
  const rows = await prisma.contract.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" }, // `query.filter_by(is_active=True).all()` : ordre des id
    include: { kindRef: true, supplier: true },
  });
  return rows.map((c) => ({ ...c, status: contractStatus(c, s) }));
}

/** Tout, en une passe (tableau de bord, menu, bilan). */
export async function chargerTout() {
  const ctx = await contexteStatuts();
  const cycles = await chargerCycles();
  const [
    accounts,
    certificates,
    domains,
    backups,
    tests,
    reviews,
    updates,
    equipments,
    software,
    contracts,
  ] = await Promise.all([
    chargerComptes(ctx.seuils),
    chargerCertificats(ctx.seuils, ctx.settings),
    chargerDomaines(ctx.seuils),
    chargerSauvegardes(),
    chargerTests(ctx.seuils),
    chargerRevues(ctx.seuils),
    chargerMisesAJour(),
    chargerEquipements(ctx.seuils, ctx.settings, cycles),
    chargerLogiciels(),
    chargerContrats(ctx.seuils),
  ]);
  return {
    ...ctx,
    accounts,
    certificates,
    domains,
    backups,
    tests,
    reviews,
    updates,
    equipments,
    software,
    contracts,
  };
}

export type Tout = Awaited<ReturnType<typeof chargerTout>>;
