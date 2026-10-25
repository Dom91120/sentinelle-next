/**
 * Constantes métier de Sentinelle, portées telles quelles depuis app/models.py.
 * Logique PURE : aucune I/O, partagée par le serveur, les composants et les tests.
 */

/** Couleur de statut (vocabulaire Bootstrap) : danger / warning / info / success. */
export type Statut = "danger" | "warning" | "info" | "success";

/** Triplet de seuils (danger ≤, attention ≤, proche ≤) en jours restants. */
export type Triplet = readonly [number, number, number];

// Seuils par défaut (danger, warning, info) en jours restants. SOURCE UNIQUE
// référencée à la fois par les modèles et par les tâches planifiées.
export const DEFAULT_THRESHOLDS: Record<string, Triplet> = {
  THRESHOLD_EXPIRY: [7, 15, 30], // comptes, certificats
  THRESHOLD_DOMAIN: [30, 60, 90], // noms de domaine
  THRESHOLD_TASK: [7, 15, 30], // tests, revues de droits
  THRESHOLD_CONTRACT: [60, 90, 180], // contrats / licences
  THRESHOLD_WARRANTY: [30, 60, 90], // fin de garantie (inventaire)
};

export type ThresholdKey = keyof typeof DEFAULT_THRESHOLDS;

/** Statut selon les jours restants et un triplet de seuils. */
export function statusFromDays(daysLeft: number, seuils: Triplet): Statut {
  const [d, w, i] = seuils;
  if (daysLeft <= d) return "danger";
  if (daysLeft <= w) return "warning";
  if (daysLeft <= i) return "info";
  return "success";
}

// Catégories soumises aux permissions par rôle (les sections Utilisateurs et
// Préférences restent réservées aux administrateurs via is_admin).
/** Dans l'ordre du menu : échéances, exploitation, parc, puis les alertes (administration). */
export const PERMISSION_CATEGORIES = [
  "accounts",
  "certificates",
  "domains",
  "contracts",
  "backups",
  "tests",
  "updates",
  "reviews",
  "inventory",
  "software",
  "suppliers",
  "alerts",
] as const;
export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<PermissionCategory, string> = {
  accounts: "Comptes",
  certificates: "Certificats",
  domains: "Domaines",
  contracts: "Contrats",
  backups: "Sauvegardes",
  tests: "Tests",
  updates: "Mises à jour",
  reviews: "Revues de droits",
  inventory: "Matériel",
  software: "Logiciels",
  suppliers: "Fournisseurs",
  alerts: "Alertes",
};
/** Droit dont un nouveau droit hérite à sa création : (nouveau → source). */
export const PERMISSION_INHERITANCE: Record<string, PermissionCategory> = {
  software: "inventory",
  suppliers: "contracts",
};
/** Niveaux : 0 aucun, 1 lecture, 2 écriture, 3 suppression (cumulatifs). */
export const PERMISSION_LEVELS: Record<number, string> = {
  0: "Aucun",
  1: "Lecture",
  2: "Écriture",
  3: "Suppression",
};

/** Catégories agrégées dans l'indicateur « Conformité globale » du tableau de bord. */
export const CONFORMITY_CATEGORIES = [
  "accounts",
  "certificates",
  "domains",
  "backups",
  "tests",
  "reviews",
  "updates",
  "inventory",
  "software",
  "contracts",
] as const;
export type ConformityCategory = (typeof CONFORMITY_CATEGORIES)[number];
export const CONFORMITY_LABELS: Record<string, string> = { ...CATEGORY_LABELS };
/** Catégories auxquelles un webhook peut s'abonner : celles des droits, hors le journal des alertes. */
export const WEBHOOK_CATEGORIES = PERMISSION_CATEGORIES.filter((c) => c !== "alerts");
export const WEBHOOK_CHANNELS: Record<string, string> = {
  teams: "Microsoft Teams",
  slack: "Slack",
  discord: "Discord",
};

// ── Certificats ──
export const CERT_KIND_LABELS: Record<string, string> = {
  tls: "Certificat TLS",
  signature: "Certificat électronique",
};
export const CIVILITY_LABELS: Record<string, string> = { m: "M.", mme: "Mme" };
export const CERT_USAGE_LABELS: Record<string, string> = {
  serveur: "Serveur TLS / SSL",
  signature: "Signature",
  authentification: "Authentification",
  cachet: "Cachet serveur",
  messagerie: "Messagerie (S/MIME)",
  code: "Signature de code",
  horodatage: "Horodatage",
  autre: "Autre",
};
export const CERT_SUPPORT_LABELS: Record<string, string> = {
  carte: "Carte à puce",
  cle_usb: "Clé USB",
  logiciel: "Fichier logiciel",
  autre: "Autre",
};
export const CERT_VALIDITY_LABELS: Record<string, string> = {
  valide: "Valide",
  revoque: "Révoqué",
  suspendu: "Suspendu",
};

// ── Sauvegardes ──
export const BACKUP_FREQ_PERIOD: Record<string, number> = { daily: 1, weekly: 7, monthly: 31 };
export const BACKUP_FREQ_TOLERANCE: Record<string, number> = { daily: 1, weekly: 2, monthly: 5 };
export const BACKUP_FREQ_LABEL: Record<string, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
};

// ── Inventaire matériel ──
export const EQUIPMENT_KIND_LABELS: Record<string, string> = {
  vm: "VM",
  physical: "Serveur physique",
  nas: "NAS",
  storage: "Baie de stockage",
  network: "Équipement réseau",
};
export const EQUIPMENT_KIND_ICONS: Record<string, string> = {
  vm: "monitor",
  physical: "server",
  nas: "hard-drive",
  storage: "database",
  network: "router",
};
export const EQUIPMENT_FAMILIES: Record<string, readonly string[]> = {
  serveurs: ["vm", "physical", "nas", "storage"],
  reseau: ["network"],
};
export const EQUIPMENT_FAMILY_LABELS: Record<string, string> = {
  serveurs: "Serveurs",
  reseau: "Réseau",
};
/** La famille d'une nature. Une nature inconnue retombe côté serveurs. */
export function equipmentFamily(kind: string | null | undefined): string {
  for (const [famille, natures] of Object.entries(EQUIPMENT_FAMILIES)) {
    if (kind && natures.includes(kind)) return famille;
  }
  return "serveurs";
}
export const EQUIPMENT_KIND_GROUPS: Record<string, readonly string[]> = {
  materiel: ["physical", "nas", "storage", "network"],
  stockage: ["nas", "storage"],
  reseau: ["vm", "physical", "nas", "storage", "network"],
  vlan: ["vm", "network"],
  supervision: ["physical", "nas", "storage", "network"],
  virtualisation: ["vm"],
  services: ["vm", "physical"],
  usage: ["nas", "storage"],
  pra: ["physical", "storage"],
  emplacement: ["physical", "nas", "storage", "network"],
  administration: ["nas", "storage", "network"],
  ports: ["network"],
};
export const EQUIPMENT_KIND_GROUPS_ATTR: Record<string, string> = Object.fromEntries(
  Object.entries(EQUIPMENT_KIND_GROUPS).map(([k, v]) => [k, v.join(" ")]),
);
/** Cette nature d'équipement porte-t-elle ce groupe d'informations ? */
export function equipmentPorte(kind: string | null | undefined, groupe: string): boolean {
  return (EQUIPMENT_KIND_GROUPS[groupe] ?? []).includes(kind || "vm");
}
export const ENVIRONMENT_LABELS: Record<string, string> = {
  prod: "Production",
  preprod: "Préproduction",
  dev: "Développement",
  decommissioned: "Décommissionné",
};
export const CRITICALITY_LABELS: Record<number, string> = {
  1: "1 - Faible",
  2: "2 - Modérée",
  3: "3 - Élevée",
  4: "4 - Vitale",
};
export const CRITICALITY_COLORS: Record<number, string> = {
  1: "secondary",
  2: "info",
  3: "warning",
  4: "danger",
};

// ── Fournisseurs ──
export const SUPPLIER_KIND_LABELS: Record<string, string> = {
  editor: "Éditeur logiciel",
  manufacturer: "Constructeur",
  provider: "Prestataire",
  operator: "Opérateur",
  ca: "Autorité de certification",
  registrar: "Bureau d'enregistrement",
  other: "Autre",
};

// ── Contrats ──
export const CONTRACT_KIND_LABELS: Record<string, string> = {
  maintenance: "Maintenance",
  licence: "Licence",
  subscription: "Abonnement",
  market: "Marché public",
  other: "Autre",
};
export const CONTRACT_NATURE_LABELS: Record<string, string> = {
  marche: "Marché",
  contrat: "Contrat",
};

// ── Référentiels ──
export const REFERENTIAL_KINDS: Record<string, string> = {
  technology: "Technologies applicatives",
  doc_category: "Catégories de pièces jointes",
  task_type: "Types de tâches récurrentes",
  contract_kind: "Types de contrat",
  cert_usage: "Usages de certificat",
  cert_support: "Supports de certificat",
};
export const REFERENTIAL_SCOPES: Record<string, Record<string, string>> = {
  cert_usage: { tous: "Tous les types", tls: "Serveur (TLS)", signature: "Nominatif" },
};
export const REFERENTIAL_SEED_SCOPES: Record<string, Record<string, string>> = {
  cert_usage: {
    "Serveur TLS / SSL": "tls",
    Signature: "signature",
    Authentification: "signature",
    "Cachet serveur": "signature",
    "Messagerie (S/MIME)": "signature",
    "Signature de code": "signature",
    Horodatage: "signature",
    Autre: "tous",
  },
};
export const REFERENTIAL_SEEDS: Record<string, string[]> = {
  technology: ["Web", "Client lourd", "Client-serveur", "Mobile", "Service système"],
  doc_category: [
    "Contrat / marché",
    "Devis",
    "Guide utilisateur",
    "Documentation technique",
    "Délibération",
    "Arrêté",
    "Autre",
  ],
  task_type: [
    "Mise à jour",
    "Renouvellement de contrat",
    "Purge",
    "Revue des comptes",
    "Renouvellement de certificat",
  ],
  contract_kind: ["Maintenance", "Licence", "Abonnement", "Marché public", "Autre"],
  cert_usage: Object.values(CERT_USAGE_LABELS),
  cert_support: Object.values(CERT_SUPPORT_LABELS),
};

// ── Logiciels ──
export const HOSTING_LABELS: Record<string, string> = {
  on_premise: "On premise",
  saas: "SaaS (hors parc)",
  hybride: "Hybride",
};
export const LIFECYCLE_LABELS: Record<string, string> = {
  evaluation: "En évaluation",
  production: "En production",
  fin_de_vie: "En fin de vie",
  abandonne: "Abandonné",
};
export const LIFECYCLE_COLORS: Record<string, string> = {
  evaluation: "info",
  production: "success",
  fin_de_vie: "warning",
  abandonne: "secondary",
};
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  proprietaire: "Propriétaire",
  opensource: "Open source",
  mixte: "Mixte",
};
export const AUTH_MODE_LABELS: Record<string, string> = {
  locale: "Comptes locaux",
  ldap: "Annuaire (LDAP/AD)",
  sso: "SSO / fournisseur d'identité",
  mixte_ldap: "Locale + annuaire",
  mixte_sso: "Locale + SSO",
  aucune: "Aucune",
};
export const DATA_LOCATION_LABELS: Record<string, string> = {
  ue: "Union européenne",
  hors_ue: "Hors UE",
  mixte: "Mixte",
  inconnue: "Non renseignée",
};

// ── Pièces jointes ──
/** Parent → (colonne de rattachement, catégorie de droits). */
export const DOCUMENT_PARENTS: Record<string, [string, PermissionCategory]> = {
  software: ["softwareId", "software"],
  supplier: ["supplierId", "suppliers"],
  contract: ["contractId", "contracts"],
  quote: ["quoteId", "contracts"],
  certificate: ["certificateId", "certificates"],
  equipment: ["equipmentId", "inventory"],
};

// ── Alertes ──
export const ALERT_CATEGORIES = [
  "account",
  "certificate",
  "domain",
  "backup",
  "test",
  "review",
  "update",
  "equipment",
  "software",
  "contract",
] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];
export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  account: "Comptes / mots de passe",
  certificate: "Certificats",
  domain: "Domaines",
  backup: "Sauvegardes",
  test: "Tests récurrents",
  review: "Revues de droits",
  update: "Mises à jour",
  equipment: "Matériel",
  software: "Logiciels",
  contract: "Contrats & licences",
};
/** Types d'élément qu'une alerte peut viser (reports, routage). */
export const SNOOZE_VALID_TYPES = [
  "account",
  "certificate",
  "backup",
  "test",
  "domain",
  "review",
  "update",
  "equipment",
  "software",
  "contract",
] as const;
export type EntityType = (typeof SNOOZE_VALID_TYPES)[number];
const SNOOZE_PERMISSION: Record<string, PermissionCategory> = {
  equipment: "inventory",
  software: "software",
  ct: "domains",
};
/** La catégorie de droits à exiger pour reporter ou router une alerte. */
export function permissionCategory(entityType: string): PermissionCategory {
  return SNOOZE_PERMISSION[entityType] ?? (`${entityType}s` as PermissionCategory);
}
/** Préfixe d'URL de la fiche quand il diffère de entity_type + 's'. */
export const ENTITY_URL_PREFIX: Record<string, string> = {
  equipment: "inventory",
  software: "inventory/logiciels",
  ct: "domains",
};
export function entityUrl(entityType: string, id: number): string {
  return `/${ENTITY_URL_PREFIX[entityType] ?? `${entityType}s`}/${id}`;
}

/** Ordre d'affichage des listes : le plus critique en premier, le sain en dernier. */
export const STATUS_RANK: Record<string, number> = { danger: 0, warning: 1, info: 2, success: 3 };
export function statusRank(status: string | null | undefined): number {
  return status != null && status in STATUS_RANK ? STATUS_RANK[status] : 4;
}

/** Types de tests récurrents (app/tests.py). */
export const TEST_TYPES: [string, string][] = [
  ["restoration", "Test de restauration"],
  ["sensitive_backup", "Sauvegarde données sensibles sur clé"],
  ["disaster_recovery", "Test PCA/PRA"],
  ["integrity_check", "Vérification d'intégrité"],
  ["other", "Autre"],
];
export const TEST_TYPE_LABELS: Record<string, string> = Object.fromEntries(TEST_TYPES);
