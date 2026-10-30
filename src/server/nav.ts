/**
 * Compteurs de la barre latérale (port de `inject_nav_counts` dans app/__init__.py).
 * Leur calcul charge toutes les tables et évalue chaque statut : au plus une fois
 * par minute (cache process). Les éléments reportés (snooze) sont exclus.
 */

import { nouvelleVersionDisponible } from "@/lib/statuts";
import { prisma } from "@/server/db";
import { chargerTout } from "@/server/donnees";
import type { CurrentUser } from "@/server/guards";
import { activeSnoozeKeys } from "@/server/snooze";

const TTL_MS = process.env.SENTINELLE_TEST ? 0 : 60_000;
type Cache = { at: number; danger: Record<string, number>; trash: Record<string, number> };
// Sur globalThis, pour la même raison que le cache des réglages (config-store) : la route
// qui invalide et la page qui lit peuvent tenir deux exemplaires de ce module.
const partage = globalThis as unknown as { __sentinelleNav?: { cache: Cache | null } };
partage.__sentinelleNav ??= { cache: null };
const memo = partage.__sentinelleNav;

export const TRASH_CATEGORIES = [
  "accounts",
  "certificates",
  "domains",
  "backups",
  "tests",
  "reviews",
  "updates",
  "inventory",
  "contracts",
] as const;

async function calculer(): Promise<Cache> {
  const [tout, snoozed] = await Promise.all([chargerTout(), activeSnoozeKeys()]);
  const danger = (items: { id: number; status: string }[], etype: string) =>
    items.filter((i) => !snoozed.has(`${etype}:${i.id}`) && i.status === "danger").length;
  const dangerCounts = {
    accounts: danger(tout.accounts, "account"),
    certificates: danger(tout.certificates, "certificate"),
    domains: danger(tout.domains, "domain"),
    backups: danger(tout.backups, "backup"),
    tests: danger(tout.tests, "test"),
    reviews: danger(tout.reviews, "review"),
    updates: danger(tout.updates, "update"),
    inventory: danger(tout.equipments, "equipment"),
    software: danger(tout.software, "software"),
    contracts: danger(tout.contracts, "contract"),
    // Mises à jour : les disponibles (orange) ont leur propre pastille, à côté des critiques.
    // Une fiche critique dont une nouvelle version est connue compte dans les deux.
    "updates:warning": tout.updates.filter(
      (u) =>
        !snoozed.has(`update:${u.id}`) &&
        (u.effectif === "update_available" ||
          nouvelleVersionDisponible(u.currentVersion, u.latestVersion)),
    ).length,
  };
  const [acc, cert, dom, bkp, tst, rev, upd, eq, ctr] = await Promise.all([
    prisma.account.count({ where: { isActive: false } }),
    prisma.certificate.count({ where: { isActive: false } }),
    prisma.domain.count({ where: { isActive: false } }),
    prisma.backup.count({ where: { isActive: false } }),
    prisma.testTask.count({ where: { isActive: false } }),
    prisma.accessReview.count({ where: { isActive: false } }),
    prisma.systemUpdate.count({ where: { isActive: false } }),
    prisma.equipment.count({ where: { isActive: false } }),
    prisma.contract.count({ where: { isActive: false } }),
  ]);
  return {
    at: Date.now(),
    danger: dangerCounts,
    trash: {
      accounts: acc,
      certificates: cert,
      domains: dom,
      backups: bkp,
      tests: tst,
      reviews: rev,
      updates: upd,
      inventory: eq,
      contracts: ctr,
    },
  };
}

export function invalidateNavCounts(): void {
  memo.cache = null;
}

/** `nav_counts` : compteurs danger par catégorie + corbeille (selon les droits de l'utilisateur). */
export async function navCounts(user: CurrentUser): Promise<Record<string, number>> {
  if (!memo.cache || Date.now() - memo.cache.at > TTL_MS) {
    try {
      memo.cache = await calculer();
    } catch (e) {
      console.error("[nav] compteurs impossibles :", e);
      return {};
    }
  }
  const counts: Record<string, number> = { ...memo.cache.danger };
  counts.trash = Object.entries(memo.cache.trash).reduce(
    (n, [cat, c]) => (user.canEdit(cat) ? n + c : n),
    0,
  );
  return counts;
}
