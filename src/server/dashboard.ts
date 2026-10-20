/**
 * Tableau de bord (port de app/dashboard.py) : blocs personnalisables, vignettes
 * de synthèse, urgences, échéances à venir, conformité globale.
 */
import { delai } from "@/lib/libelles";
import { backupTodayCheck, certificateLabel, contractActionDeadline } from "@/lib/statuts";
import { getConformityCategories } from "@/server/app-settings";
import { prisma } from "@/server/db";
import { chargerTout, type Tout } from "@/server/donnees";
import type { CurrentUser } from "@/server/guards";

export type Widget = { key: string; label: string; icon: string; span: number };

export const DASHBOARD_WIDGETS: Widget[] = [
  { key: "conformity", label: "Conformité globale", icon: "bi-speedometer2", span: 12 },
  { key: "stats", label: "Vignettes de synthèse", icon: "bi-grid-3x3-gap", span: 12 },
  {
    key: "backups_today",
    label: "Validation des sauvegardes du jour",
    icon: "bi-cloud-arrow-up",
    span: 12,
  },
  {
    key: "attention",
    label: "Éléments requérant votre attention",
    icon: "bi-exclamation-triangle",
    span: 12,
  },
  { key: "upcoming", label: "À venir", icon: "bi-calendar-event", span: 6 },
  { key: "alerts", label: "Dernières alertes", icon: "bi-bell", span: 6 },
];
export const WIDGET_SPAN_DEFAULT: Record<string, number> = Object.fromEntries(
  DASHBOARD_WIDGETS.map((w) => [w.key, w.span]),
);
export const WIDGET_SPAN_MIN = 3;
export const WIDGET_SPAN_MAX = 12;

export type StatCard = {
  key: string;
  cat: string;
  label: string;
  icon: string;
  color: string;
  singulier: string;
  href: string;
};

export const STAT_CARDS: StatCard[] = [
  {
    key: "accounts",
    cat: "accounts",
    label: "Comptes",
    icon: "bi-key",
    color: "#6366f1",
    singulier: "Compte",
    href: "/accounts",
  },
  {
    key: "certificates",
    cat: "certificates",
    label: "Certificats",
    icon: "bi-award",
    color: "#10b981",
    singulier: "Certificat",
    href: "/certificates",
  },
  {
    key: "domains",
    cat: "domains",
    label: "Domaines",
    icon: "bi-globe",
    color: "#3b82f6",
    singulier: "Domaine",
    href: "/domains",
  },
  {
    key: "backups",
    cat: "backups",
    label: "Sauvegardes",
    icon: "bi-cloud-arrow-up",
    color: "#06b6d4",
    singulier: "Sauvegarde",
    href: "/backups",
  },
  {
    key: "tests",
    cat: "tests",
    label: "Tests",
    icon: "bi-clipboard-check",
    color: "#f59e0b",
    singulier: "Test",
    href: "/tests",
  },
  {
    key: "reviews",
    cat: "reviews",
    label: "Revues de droits",
    icon: "bi-person-check",
    color: "#8b5cf6",
    singulier: "Revue de droits",
    href: "/reviews",
  },
  {
    key: "updates",
    cat: "updates",
    label: "Mises à jour",
    icon: "bi-arrow-up-circle",
    color: "#ec4899",
    singulier: "Mise à jour",
    href: "/updates",
  },
  {
    key: "inventory",
    cat: "inventory",
    label: "Matériels",
    icon: "bi-hdd-stack",
    color: "#0ea5e9",
    singulier: "Matériel",
    href: "/inventory",
  },
  {
    key: "software",
    cat: "software",
    label: "Logiciels",
    icon: "bi-window-stack",
    color: "#a855f7",
    singulier: "Logiciel",
    href: "/inventory/logiciels",
  },
  {
    key: "contracts",
    cat: "contracts",
    label: "Contrats",
    icon: "bi-file-earmark-text",
    color: "#14b8a6",
    singulier: "Contrat",
    href: "/contracts",
  },
];

type Prefs = {
  order?: string[];
  hidden?: string[];
  spans?: Record<string, unknown>;
  cards?: string[];
  hidden_cards?: string[];
};

export function loadPrefs(user: { dashboardPrefs: string | null }): Prefs {
  if (!user.dashboardPrefs) return {};
  try {
    return (JSON.parse(user.dashboardPrefs) as Prefs) ?? {};
  } catch {
    return {};
  }
}

export function resolveCardLayout(
  user: { dashboardPrefs: string | null },
  available: string[],
): [string[], string[]] {
  const availSet = new Set(available);
  const prefs = loadPrefs(user);
  const hidden = (prefs.hidden_cards ?? []).filter((k) => availSet.has(k));
  const hiddenSet = new Set(hidden);
  const saved = (prefs.cards ?? []).filter((k) => availSet.has(k) && !hiddenSet.has(k));
  const seen = new Set([...saved, ...hidden]);
  return [[...saved, ...available.filter((k) => !seen.has(k))], hidden];
}

export function resolveWidgetSpans(user: {
  dashboardPrefs: string | null;
}): Record<string, number> {
  const spans = { ...WIDGET_SPAN_DEFAULT };
  const saved = loadPrefs(user).spans;
  for (const [key, val] of Object.entries(saved && typeof saved === "object" ? saved : {})) {
    if (!(key in spans)) continue;
    const n = Number.parseInt(String(val), 10);
    if (Number.isInteger(n) && n >= WIDGET_SPAN_MIN && n <= WIDGET_SPAN_MAX) spans[key] = n;
  }
  return spans;
}

export function resolveDashboardLayout(
  user: { dashboardPrefs: string | null },
  available: string[],
): [string[], string[]] {
  const prefs = loadPrefs(user);
  const availSet = new Set(available);
  const hidden = (prefs.hidden ?? []).filter((k) => availSet.has(k));
  const hiddenSet = new Set(hidden);
  const savedVisible = (prefs.order ?? []).filter((k) => availSet.has(k) && !hiddenSet.has(k));
  const seen = new Set([...savedVisible, ...hidden]);
  return [[...savedVisible, ...available.filter((k) => !seen.has(k))], hidden];
}

export type Horizon = "depasse" | "semaine" | "a-traiter" | "mois" | "plus-tard";

export type Urgent = {
  type: string;
  name: string;
  detail: string;
  days: number | null;
  action: string | null;
  ancre: string | null;
  status: string;
  url: string;
  horizon: Horizon;
};

export type Counts = { total: number; danger: number; warning: number; ok: number };

function counts(items: { status: string }[]): Counts {
  return {
    total: items.length,
    danger: items.filter((i) => i.status === "danger").length,
    warning: items.filter((i) => i.status === "warning").length,
    ok: items.filter((i) => i.status === "success").length,
  };
}

function horizon(d: number | null): Horizon {
  if (d === null) return "a-traiter";
  if (d < 0) return "depasse";
  if (d <= 7) return "semaine";
  if (d <= 31) return "mois";
  return "plus-tard";
}

const ORDRE: Record<Horizon, number> = {
  depasse: 0,
  semaine: 1,
  "a-traiter": 2,
  mois: 3,
  "plus-tard": 4,
};
const RANG: Record<string, number> = { danger: 0, warning: 1, info: 2 };

/** Toutes les données du tableau de bord pour `user` (seules les catégories visibles). */
export async function dashboardData(user: CurrentUser) {
  const tout: Tout = await chargerTout();
  const { today } = tout;
  const jours = (d: Date) =>
    Math.round(
      (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - today.getTime()) /
        86_400_000,
    );
  const accounts = user.canView("accounts") ? tout.accounts : [];
  const certificates = user.canView("certificates") ? tout.certificates : [];
  const domains = user.canView("domains") ? tout.domains : [];
  const backups = user.canView("backups") ? tout.backups : [];
  const tests = user.canView("tests") ? tout.tests : [];
  const reviews = user.canView("reviews") ? tout.reviews : [];
  const updates = user.canView("updates") ? tout.updates : [];
  const equipments = user.canView("inventory") ? tout.equipments : [];
  const software = user.canView("software") ? tout.software : [];
  const contracts = user.canView("contracts") ? tout.contracts : [];

  const urgent: Urgent[] = [];
  const push = (u: Omit<Urgent, "horizon">) => urgent.push({ ...u, horizon: horizon(u.days) });
  for (const a of accounts) {
    if (a.status !== "danger") continue;
    const days = a.nextPasswordChange ? jours(a.nextPasswordChange) : null;
    push({
      type: "account",
      name: `${a.serviceName} (${a.username})`,
      detail: days !== null ? `Mot de passe ${delai(days)}` : "Date de rotation non definie",
      days,
      action: "Mot de passe changé",
      ancre: "mdp-change",
      status: "danger",
      url: `/accounts/${a.id}`,
    });
  }
  for (const c of certificates) {
    if ((c.status === "danger" || c.status === "warning") && c.expiryDate) {
      const days = jours(c.expiryDate);
      push({
        type: "certificate",
        name: certificateLabel(c),
        detail: `Certificat ${delai(days, "expiré depuis", "expire dans")}`,
        days,
        action: "Renouvelé",
        ancre: "renouveler",
        status: c.status,
        url: `/certificates/${c.id}`,
      });
    }
  }
  for (const d of domains) {
    if ((d.status === "danger" || d.status === "warning") && d.expiryDate) {
      const days = jours(d.expiryDate);
      push({
        type: "domain",
        name: d.name,
        detail: `Domaine ${delai(days, "expiré depuis", "expire dans")}`,
        days,
        action: null,
        ancre: null,
        status: d.status,
        url: `/domains/${d.id}`,
      });
    }
  }
  for (const b of backups) {
    if (b.status !== "danger") continue;
    const tc = backupTodayCheck(b.checks, today);
    push({
      type: "backup",
      name: b.serviceName,
      detail: tc ? `Check: ${tc.status}` : "Non verifie",
      days: null,
      action: "Enregistrer un check",
      ancre: "check",
      status: "danger",
      url: `/backups/${b.id}`,
    });
  }
  for (const t of tests) {
    if (t.status !== "danger") continue;
    const days = t.nextDue ? jours(t.nextDue) : null;
    push({
      type: "test",
      name: t.name,
      detail:
        days !== null
          ? `Test ${delai(days, "en retard de", "à faire dans")}`
          : "Echeance non planifiee",
      days,
      action: "Effectué",
      ancre: "effectue",
      status: "danger",
      url: `/tests/${t.id}`,
    });
  }
  for (const r of reviews) {
    if (r.status === "danger" || r.status === "warning") {
      const days = r.nextReview ? jours(r.nextReview) : null;
      push({
        type: "review",
        name: r.application,
        detail: days !== null ? `Revue ${delai(days)}` : "Revue à planifier",
        days,
        action: "Valider la revue",
        ancre: "valider",
        status: r.status,
        url: `/reviews/${r.id}`,
      });
    }
  }
  for (const u of updates) {
    if (u.status === "danger" || u.status === "warning") {
      push({
        type: "update",
        name: u.name,
        detail: u.status === "danger" ? "Mise a jour critique" : "Mise a jour disponible",
        days: null,
        action: "À jour",
        ancre: "a-jour",
        status: u.status,
        url: `/updates/${u.id}`,
      });
    }
  }
  for (const s of software) {
    if (s.status === "danger" || s.status === "warning") {
      const detail =
        s.status === "danger"
          ? "Mise à jour critique en attente"
          : s.lifecycle === "fin_de_vie"
            ? "En fin de vie, successeur à trouver"
            : "Mise à jour disponible";
      push({
        type: "software",
        name: s.name,
        detail,
        days: null,
        action: null,
        ancre: null,
        status: s.status,
        url: `/inventory/logiciels/${s.id}`,
      });
    }
  }
  for (const c of contracts) {
    if (c.status === "danger" || c.status === "warning") {
      const deadline = contractActionDeadline(c);
      const days = deadline ? jours(deadline) : null;
      let detail = "Échéance à renseigner";
      if (days !== null) {
        const d = delai(days, "Préavis dépassé de", "Agir dans");
        detail = d.charAt(0).toUpperCase() + d.slice(1);
      }
      push({
        type: "contract",
        name: c.name,
        detail,
        days,
        action: "Renouvelé",
        ancre: "renouveler",
        status: c.status,
        url: `/contracts/${c.id}`,
      });
    }
  }
  urgent.sort((x, y) => {
    const o = ORDRE[x.horizon] - ORDRE[y.horizon];
    if (o !== 0) return o;
    const dx = x.days ?? 0;
    const dy = y.days ?? 0;
    if (dx !== dy) return dx - dy;
    return (RANG[x.status] ?? 3) - (RANG[y.status] ?? 3);
  });

  const recentAlerts = await prisma.alertLog.findMany({ orderBy: { sentAt: "desc" }, take: 10 });

  type Upcoming = { days: number; label: string; icon: string; url: string };
  const upcoming: Upcoming[] = [];
  const addUp = (date: Date | null, label: string, icon: string, url: string) => {
    if (!date) return;
    const d = jours(date);
    if (d >= 0 && d <= 60) upcoming.push({ days: d, label, icon, url });
  };
  for (const a of accounts)
    addUp(a.nextPasswordChange, `${a.serviceName} (${a.username})`, "bi-key", `/accounts/${a.id}`);
  for (const c of certificates)
    addUp(c.expiryDate, certificateLabel(c), "bi-award", `/certificates/${c.id}`);
  for (const d of domains) addUp(d.expiryDate, d.name, "bi-globe", `/domains/${d.id}`);
  for (const t of tests) addUp(t.nextDue, t.name, "bi-clipboard-check", `/tests/${t.id}`);
  for (const r of reviews)
    addUp(r.nextReview, r.application, "bi-person-check", `/reviews/${r.id}`);
  for (const e of equipments)
    addUp(e.warrantyEnd, `${e.name} (garantie)`, "bi-hdd-stack", `/inventory/${e.id}`);
  for (const c of contracts)
    addUp(
      contractActionDeadline(c),
      `${c.name} (contrat)`,
      "bi-file-earmark-text",
      `/contracts/${c.id}`,
    );
  upcoming.sort((a, b) => a.days - b.days);

  const backupChecks = new Map(
    backups.map((b) => [b.id, backupTodayCheck(b.checks, today) ?? null]),
  );

  const stats: Record<string, Counts> = {
    accounts: counts(accounts),
    certificates: counts(certificates),
    domains: counts(domains),
    backups: counts(backups),
    tests: counts(tests),
    reviews: counts(reviews),
    updates: counts(updates),
    inventory: counts(equipments),
    software: counts(software),
    contracts: counts(contracts),
  };

  const included = new Set(await getConformityCategories());
  const totals = { total: 0, ok: 0, warning: 0, danger: 0 };
  for (const [cat, v] of Object.entries(stats)) {
    if (!included.has(cat as never)) continue;
    totals.total += v.total;
    totals.ok += v.ok;
    totals.warning += v.warning;
    totals.danger += v.danger;
  }
  const conformity = totals.total ? Math.round((100 * totals.ok) / totals.total) : 100;

  const available: string[] = [];
  for (const w of DASHBOARD_WIDGETS) {
    if (w.key === "conformity" && !totals.total) continue;
    if (w.key === "backups_today" && !(backups.length && user.canView("backups"))) continue;
    if (w.key === "alerts" && !user.canView("alerts")) continue;
    available.push(w.key);
  }
  const availableCards = STAT_CARDS.filter((c) => user.canView(c.cat)).map((c) => c.key);
  const dashboardCustom = Boolean(user.settings.DASHBOARD_CUSTOM);
  let dashVisible: string[];
  let dashHidden: string[];
  let dashSpans: Record<string, number>;
  let cardOrder: string[];
  let cardHidden: string[];
  if (dashboardCustom) {
    [dashVisible, dashHidden] = resolveDashboardLayout(user, available);
    dashSpans = resolveWidgetSpans(user);
    [cardOrder, cardHidden] = resolveCardLayout(user, availableCards);
  } else {
    dashVisible = available;
    dashHidden = [];
    dashSpans = { ...WIDGET_SPAN_DEFAULT };
    cardOrder = availableCards;
    cardHidden = [];
  }
  const cardMeta = new Map(STAT_CARDS.map((c) => [c.key, c]));
  const cardView = (k: string) => ({ ...(cardMeta.get(k) as StatCard), s: stats[k] });
  const backupsAValider = backups.filter((b) => !backupChecks.get(b.id)).length;

  return {
    today,
    stats,
    urgentItems: urgent,
    backupsAValider,
    recentAlerts,
    backups,
    backupChecks,
    totals,
    conformity,
    upcoming: upcoming.slice(0, 7),
    dashboardCustom,
    dashVisible,
    dashHidden,
    dashSpans,
    dashCards: cardOrder.map(cardView),
    dashHiddenCards: cardHidden.map(cardView),
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
