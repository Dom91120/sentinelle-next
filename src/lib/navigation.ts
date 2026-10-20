/**
 * Le menu, en un seul endroit (port de app/navigation.py).
 *
 * Quatre domaines : Aujourd'hui, Échéances, Exploitation, Parc ; l'administration
 * est repliée. La même structure sert au fil d'Ariane.
 *
 * Chaque entrée : chemin de la page (remplace l'endpoint Flask), libellé, icône
 * Bootstrap, catégorie de droit (`perm`, null = toujours visible), clé du compteur
 * de la barre latérale (`count`), préfixe d'URL du module (`blueprint`) et icône Lucide.
 */
import type { PermissionCategory } from "@/lib/constantes";

export type NavEntry = {
  endpoint: string;
  href: string;
  label: string;
  icon: string;
  perm: PermissionCategory | null;
  count: string | null;
  blueprint: string;
  lucide: string | null;
  admin?: boolean;
};

export type NavDomaine = { key: string; label: string; entries: NavEntry[] };

function e(
  endpoint: string,
  href: string,
  label: string,
  icon: string,
  perm: PermissionCategory | null = null,
  count: string | null = null,
  lucide: string | null = null,
  blueprint?: string,
): NavEntry {
  return {
    endpoint,
    href,
    label,
    icon,
    perm,
    count,
    blueprint: blueprint ?? endpoint.split(".")[0],
    lucide,
  };
}

export const DOMAINES: NavDomaine[] = [
  {
    key: "aujourdhui",
    label: "Aujourd'hui",
    entries: [
      e("dashboard.index", "/", "Tableau de bord", "bi-grid-1x2", null, null, "layout-dashboard"),
      e("dashboard.agenda", "/agenda", "À venir", "bi-calendar-event", null, null, "calendar-days"),
      e("dashboard.trends", "/tendances", "Tendances", "bi-graph-up", null, null, "chart-column"),
    ],
  },
  {
    key: "echeances",
    label: "Échéances",
    entries: [
      e("accounts.list", "/accounts", "Comptes", "bi-key", "accounts", "accounts", "key-round"),
      e(
        "certificates.list",
        "/certificates",
        "Certificats",
        "bi-award",
        "certificates",
        "certificates",
        "shield-check",
      ),
      e("domains.list", "/domains", "Domaines", "bi-globe", "domains", "domains", "globe"),
      e(
        "contracts.list",
        "/contracts",
        "Contrats",
        "bi-file-earmark-text",
        "contracts",
        "contracts",
        "file-pen",
      ),
    ],
  },
  {
    key: "exploitation",
    label: "Exploitation",
    entries: [
      e(
        "backups.list",
        "/backups",
        "Sauvegardes",
        "bi-cloud-arrow-up",
        "backups",
        "backups",
        "cloud-upload",
      ),
      e("tests.list", "/tests", "Tests", "bi-clipboard-check", "tests", "tests", "clipboard-list"),
      e(
        "updates.list",
        "/updates",
        "Mises à jour",
        "bi-arrow-up-circle",
        "updates",
        "updates",
        "refresh-cw",
      ),
      e(
        "reviews.list",
        "/reviews",
        "Revues de droits",
        "bi-person-check",
        "reviews",
        "reviews",
        "user-check",
      ),
    ],
  },
  {
    key: "parc",
    label: "Parc",
    entries: [
      e(
        "inventory.list",
        "/inventory",
        "Matériel",
        "bi-hdd-stack",
        "inventory",
        "inventory",
        "server",
      ),
      e(
        "software.list",
        "/inventory/logiciels",
        "Logiciels",
        "bi-window-stack",
        "software",
        "software",
        "app-window",
      ),
      e(
        "suppliers.list",
        "/suppliers",
        "Fournisseurs",
        "bi-building",
        "suppliers",
        null,
        "building",
      ),
    ],
  },
];

export const ADMINISTRATION: NavDomaine = {
  key: "administration",
  label: "Administration",
  entries: [
    {
      ...e("alerts.list", "/alerts", "Alertes envoyées", "bi-bell", "alerts", null, "bell"),
      admin: false,
    },
    { ...e("users.list", "/users", "Utilisateurs", "bi-people", null, null, "users"), admin: true },
    {
      ...e(
        "users.roles",
        "/users/roles",
        "Rôles & permissions",
        "bi-shield-lock",
        null,
        null,
        "shield",
      ),
      admin: true,
    },
    {
      ...e(
        "users.audit",
        "/users/audit",
        "Journal d'audit",
        "bi-journal-text",
        null,
        null,
        "notebook-text",
      ),
      admin: true,
    },
    {
      ...e(
        "users.scheduler_status",
        "/users/scheduler",
        "Tâches planifiées",
        "bi-clock",
        null,
        null,
        "calendar-clock",
      ),
      admin: true,
    },
    {
      ...e(
        "connectors.index",
        "/connecteurs",
        "Connecteurs",
        "bi-plugin",
        null,
        null,
        "plug",
        "connectors",
      ),
      admin: true,
    },
    {
      ...e(
        "auth.preferences",
        "/preferences",
        "Préférences",
        "bi-sliders",
        null,
        null,
        "sliders-horizontal",
      ),
      admin: true,
    },
  ],
};

/** Pages sans entrée de menu mais appartenant à un domaine : chemin → (domaine, libellé). */
const ORPHELINS: Record<string, [string, string]> = {
  "/trash": ["aujourdhui", "Corbeille"],
  "/etat": ["aujourdhui", "Par état"],
  "/search": ["aujourdhui", "Recherche"],
  "/profile": ["administration", "Mon profil"],
  "/2fa": ["administration", "Double authentification"],
  "/referentiels": ["administration", "Référentiels"],
};

export function tousDomaines(): NavDomaine[] {
  return [...DOMAINES, ADMINISTRATION];
}

/** Icône Bootstrap → icône Lucide pour tout ce qui représente un module hors du menu. */
export const LUCIDE_PAR_ICONE: Record<string, string> = Object.fromEntries(
  tousDomaines()
    .flatMap((d) => d.entries)
    .filter((x) => x.lucide)
    .map((x) => [x.icon, x.lucide as string]),
);
LUCIDE_PAR_ICONE["bi-trash3"] = "trash-2";

/** Les icônes des RUBRIQUES de fiche, avec la couleur de leur pastille. */
export const RUBRIQUES: Record<string, [string, string]> = {
  "bi-journal-text": ["notebook-text", "indigo"],
  "bi-file-earmark-text": ["file-pen", "orange"],
  "bi-paperclip": ["paperclip", "indigo"],
  "bi-folder2-open": ["folder-open", "indigo"],
  "bi-info-circle": ["info", "sky"],
  "bi-flag": ["flag", "rose"],
  "bi-tag": ["tag", "indigo"],
  "bi-tags": ["tags", "indigo"],
  "bi-key": ["key-round", "orange"],
  "bi-shield-lock": ["lock-keyhole", "orange"],
  "bi-shield-check": ["shield-check", "orange"],
  "bi-patch-check": ["badge-check", "orange"],
  "bi-award": ["shield-check", "orange"],
  "bi-person-lock": ["user-lock", "orange"],
  "bi-person": ["user", "violet"],
  "bi-people": ["users", "violet"],
  "bi-person-badge": ["id-card", "violet"],
  "bi-person-check": ["user-check", "violet"],
  "bi-person-gear": ["user-cog", "violet"],
  "bi-person-lines-fill": ["contact-round", "violet"],
  "bi-building": ["building", "violet"],
  "bi-diagram-3": ["network", "violet"],
  "bi-diagram-2": ["git-fork", "violet"],
  "bi-calendar-event": ["calendar-days", "amber"],
  "bi-calendar-check": ["calendar-check", "amber"],
  "bi-calendar-range": ["calendar-range", "amber"],
  "bi-arrow-repeat": ["refresh-cw", "amber"],
  "bi-arrow-up-circle": ["refresh-cw", "emerald"],
  "bi-cash-coin": ["coins", "orange"],
  "bi-receipt": ["receipt", "orange"],
  "bi-hdd-stack": ["server", "sky"],
  "bi-hdd-network": ["hard-drive", "sky"],
  "bi-hdd": ["hard-drive", "sky"],
  "bi-pc-display": ["monitor", "sky"],
  "bi-cpu": ["cpu", "sky"],
  "bi-window-stack": ["app-window", "sky"],
  "bi-globe": ["globe", "sky"],
  "bi-cloud": ["cloud", "emerald"],
  "bi-cloud-arrow-up": ["cloud-upload", "emerald"],
  "bi-clipboard-check": ["clipboard-list", "emerald"],
  "bi-life-preserver": ["life-buoy", "emerald"],
  "bi-tools": ["wrench", "slate"],
  "bi-sliders": ["sliders-horizontal", "slate"],
  "bi-gear-wide-connected": ["settings", "slate"],
};

/** Les icônes d'INTERFACE : seulement leur équivalent Lucide. */
export const GENERIQUES: Record<string, string> = {
  "bi-activity": "activity",
  "bi-arrow-counterclockwise": "rotate-ccw",
  "bi-arrow-down-up": "arrow-down-up",
  "bi-arrow-left": "arrow-left",
  "bi-arrow-right": "arrow-right",
  "bi-bar-chart": "chart-column",
  "bi-bell-slash": "bell-off",
  "bi-box-arrow-right": "log-out",
  "bi-box-arrow-up-right": "external-link",
  "bi-calendar": "calendar",
  "bi-calendar-plus": "calendar-plus",
  "bi-card-text": "file-text",
  "bi-caret-down-fill": "chevron-down",
  "bi-caret-up-fill": "chevron-up",
  "bi-check-circle": "circle-check",
  "bi-check-circle-fill": "circle-check",
  "bi-check-lg": "check",
  "bi-check2-all": "check-check",
  "bi-check2-square": "square-check",
  "bi-chevron-left": "chevron-left",
  "bi-chevron-right": "chevron-right",
  "bi-clipboard": "clipboard",
  "bi-clipboard-data": "clipboard-list",
  "bi-clock": "clock",
  "bi-clock-history": "history",
  "bi-cloud-check": "cloud-check",
  "bi-code-slash": "code",
  "bi-collection": "layers",
  "bi-dash-circle": "circle-minus",
  "bi-database": "database",
  "bi-dot": "dot",
  "bi-download": "download",
  "bi-envelope": "mail",
  "bi-envelope-arrow-down": "mail-open",
  "bi-envelope-check": "mail-check",
  "bi-exclamation-octagon-fill": "octagon-alert",
  "bi-exclamation-triangle": "triangle-alert",
  "bi-exclamation-triangle-fill": "triangle-alert",
  "bi-eye": "eye",
  "bi-eye-slash": "eye-off",
  "bi-file-earmark-arrow-down": "file-down",
  "bi-file-earmark-excel": "file-spreadsheet",
  "bi-file-earmark-pdf": "file-text",
  "bi-file-earmark-zip": "file-archive",
  "bi-folder": "folder",
  "bi-funnel": "funnel",
  "bi-funnel-fill": "funnel",
  "bi-globe2": "globe",
  "bi-graph-up": "trending-up",
  "bi-grid-1x2": "layout-panel-top",
  "bi-grid-3x3-gap": "grid-3x3",
  "bi-grip-vertical": "grip-vertical",
  "bi-hand-index": "pointer",
  "bi-inbox": "inbox",
  "bi-info-circle-fill": "info",
  "bi-kanban": "square-kanban",
  "bi-layout-three-columns": "columns-3",
  "bi-link-45deg": "link",
  "bi-list": "menu",
  "bi-list-check": "list-checks",
  "bi-list-ul": "list",
  "bi-lock": "lock",
  "bi-palette": "palette",
  "bi-pencil": "pencil",
  "bi-pencil-square": "square-pen",
  "bi-person-circle": "circle-user",
  "bi-pie-chart": "chart-pie",
  "bi-plug": "plug",
  "bi-plugin": "puzzle",
  "bi-plus-circle": "circle-plus",
  "bi-plus-lg": "plus",
  "bi-router": "router",
  "bi-search": "search",
  "bi-send": "send",
  "bi-shield-exclamation": "shield-alert",
  "bi-shield-fill-check": "shield-check",
  "bi-shield-plus": "shield-plus",
  "bi-shield-slash": "shield-off",
  "bi-shield-x": "shield-x",
  "bi-slash-circle": "ban",
  "bi-speedometer2": "gauge",
  "bi-stars": "sparkles",
  "bi-telephone": "phone",
  "bi-three-dots": "ellipsis",
  "bi-toggles": "toggle-right",
  "bi-trash": "trash-2",
  "bi-truck": "truck",
  "bi-upload": "upload",
  "bi-usb-drive": "usb",
  "bi-x-circle": "circle-x",
  "bi-x-lg": "x",
};

function bi(icone: string | null | undefined): string | null {
  if (!icone) return null;
  return icone.startsWith("bi-") ? icone : `bi-${icone}`;
}

/** Le nom Lucide d'une icône Bootstrap, ou null si rien n'y correspond. */
export function lucideDe(icone: string | null | undefined): string | null {
  const ic = bi(icone);
  if (!ic) return null;
  if (ic in LUCIDE_PAR_ICONE) return LUCIDE_PAR_ICONE[ic];
  const rubrique = RUBRIQUES[ic];
  return rubrique ? rubrique[0] : (GENERIQUES[ic] ?? null);
}

/** La couleur de pastille d'une icône de rubrique, ou « slate ». */
export function couleurIcone(icone: string | null | undefined): string {
  const rubrique = RUBRIQUES[bi(icone) ?? ""];
  return rubrique ? rubrique[1] : "slate";
}

/** (domaine, entrée) de la page courante d'après son chemin. */
export function entreeActive(pathname: string): [NavDomaine | null, NavEntry | null] {
  const p = pathname.replace(/\/+$/, "") || "/";
  for (const [prefix, [key]] of Object.entries(ORPHELINS)) {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      const dom = tousDomaines().find((d) => d.key === key) ?? null;
      return [dom, null];
    }
  }
  // Chemin exact d'abord.
  for (const dom of tousDomaines()) {
    for (const en of dom.entries) if (en.href === p) return [dom, en];
  }
  if (p.startsWith("/users")) {
    for (const dom of tousDomaines()) {
      for (const en of dom.entries) if (en.endpoint === "users.list") return [dom, en];
    }
  }
  // Préfixe le plus long (les logiciels avant le matériel).
  let meilleur: [NavDomaine, NavEntry] | null = null;
  for (const dom of tousDomaines()) {
    for (const en of dom.entries) {
      if (en.href === "/" || en.blueprint === "dashboard" || en.blueprint === "auth") continue;
      if (p.startsWith(`${en.href}/`) || p === en.href) {
        if (!meilleur || en.href.length > meilleur[1].href.length) meilleur = [dom, en];
      }
    }
  }
  return meilleur ?? [null, null];
}
