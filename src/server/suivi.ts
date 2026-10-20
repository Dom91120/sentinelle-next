/**
 * Éléments suivis, lus par un outil tiers : échéances, alertes, synthèse, recherche
 * (port de app/suivi.py). Ce que l'assistant chatIA vient lire par l'API, en LECTURE SEULE.
 *
 * Ce qui sort, et ce qui ne sort jamais : un élément se présente par son nom, son
 * échéance, son statut, son responsable et le lien vers sa fiche ; AUCUN secret, et
 * aucun texte libre (description, notes, résultat, périmètre, commentaire). La recherche
 * ne les lit pas non plus.
 */
import {
  CERT_KIND_LABELS,
  CERT_VALIDITY_LABELS,
  CONTRACT_NATURE_LABELS,
  CRITICALITY_LABELS,
  ENVIRONMENT_LABELS,
  EQUIPMENT_KIND_LABELS,
} from "@/lib/constantes";
import { aujourdhui, dateCourte, delai, statusLabel } from "@/lib/libelles";
import {
  backupExpectedIntervalDays,
  backupLastOkCheck,
  backupSuccessRate,
  backupTodayCheck,
  certificateHolderLabel,
  certificateLabel,
  certificateMonitored,
  certificateSupportLabel,
  certificateUsageLabel,
  contractActionDeadline,
  contractKindLabel,
  warrantyStatus,
} from "@/lib/statuts";
import { FREQ_LABELS } from "@/modules/backups/server";
import { criticalityLabel, hostingLabel, lifecycleLabel } from "@/modules/software/server";
import { getConformityCategories } from "@/server/app-settings";
import { prisma } from "@/server/db";
import { chargerTout, type Tout } from "@/server/donnees";
import { categoryEnabledIn } from "@/server/features";

/** Type exposé → (libellé, catégorie de droits, entity_type des alertes et des reports). */
export const TYPES: Record<string, [string, string, string]> = {
  mot_de_passe: ["Mots de passe", "accounts", "account"],
  certificat: ["Certificats", "certificates", "certificate"],
  domaine: ["Noms de domaine", "domains", "domain"],
  sauvegarde: ["Sauvegardes", "backups", "backup"],
  test: ["Tests récurrents", "tests", "test"],
  revue: ["Revues de droits", "reviews", "review"],
  mise_a_jour: ["Mises à jour", "updates", "update"],
  contrat: ["Contrats", "contracts", "contract"],
  materiel: ["Matériel", "inventory", "equipment"],
  logiciel: ["Logiciels", "software", "software"],
};
const PAR_ENTITE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPES).map(([t, [, , e]]) => [e, t]),
);

export const STATUTS = ["danger", "warning", "info", "success"] as const;
export const HORIZON_DEFAUT = 30;
export const HORIZON_MAX = 730;
export const ELEMENTS_MAX = 300;
export const RECHERCHE_MIN = 2;
export const RECHERCHE_MAX = 100;
export const RESULTATS_MAX = 20;

const ETATS_TACHE: Record<string, string> = {
  pending: "À faire",
  success: "Réussi",
  completed: "Réussi",
  failed: "En échec",
};
const ETATS_MAJ: Record<string, string> = {
  up_to_date: "À jour",
  update_available: "Mise à jour disponible",
  critical: "Mise à jour critique",
};

// ── paramètres reçus ──

export function lireHorizon(brut: string | null | undefined): number {
  if (brut === null || brut === undefined || String(brut).trim() === "") return HORIZON_DEFAUT;
  const s = String(brut).trim();
  const jours = /^-?\d+$/.test(s) ? Number.parseInt(s, 10) : -1;
  if (jours < 0 || jours > HORIZON_MAX)
    throw new Error(`Paramètre « dans » : nombre de jours attendu, de 0 à ${HORIZON_MAX}.`);
  return jours;
}

export function lireTypes(valeurs: string[] | null | undefined): string[] {
  const demandes: string[] = [];
  for (const v of valeurs ?? [])
    demandes.push(
      ...String(v)
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    );
  const inconnus = demandes.filter((t) => !(t in TYPES));
  if (inconnus.length)
    throw new Error(
      `Type inconnu : ${inconnus.join(", ")}. Types admis : ${Object.keys(TYPES).join(", ")}.`,
    );
  return [...new Set(demandes)];
}

export function lireOui(brut: string | null | undefined): boolean {
  return ["1", "true", "oui", "yes"].includes(
    String(brut ?? "")
      .trim()
      .toLowerCase(),
  );
}

export function lireRecherche(brut: string | null | undefined): string {
  const q = String(brut ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
  if (q.length < RECHERCHE_MIN || q.length > RECHERCHE_MAX)
    throw new Error(`Paramètre « q » : de ${RECHERCHE_MIN} à ${RECHERCHE_MAX} caractères.`);
  return q;
}

// ── outils communs ──

const jour = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const maintenant = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const horodatage = (d: Date | null | undefined) =>
  d ? `${d.toISOString().slice(0, 16).replace("Z", "")}+00:00` : null;

/** Minuscules sans accents : « Échéance » se trouve en tapant « echeance ». */
export function simplifier(texte: unknown): string {
  return String(texte ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export type Element = Record<string, unknown> & {
  type: string;
  id: number;
  nom: string;
  echeance: string | null;
  statut: string;
  en_retard: boolean;
};

type Options = {
  objet: string;
  echeance?: Date | null;
  detail?: string;
  type_libelle?: string;
  responsable?: string | null;
  [k: string]: unknown;
};

class Contexte {
  readonly aujourdhui = aujourdhui();
  constructor(
    readonly tout: Tout,
    readonly reports: Map<string, Date>,
    readonly base: string,
    readonly logiciels: Map<number, string>,
    readonly ctNouveaux: Map<number, number>,
  ) {}

  element(
    type: string,
    o: { id: number },
    nom: string,
    chemin: string,
    statut: string,
    { objet, echeance = null, detail = "", type_libelle, responsable, ...autres }: Options,
  ): Element {
    const jours = echeance
      ? Math.round((echeance.getTime() - this.aujourdhui.getTime()) / 86_400_000)
      : null;
    return {
      type,
      type_libelle: type_libelle ?? TYPES[type][0],
      id: o.id,
      nom,
      objet,
      echeance: jour(echeance),
      jours_restants: jours,
      en_retard: jours !== null && jours < 0,
      detail,
      statut,
      statut_libelle: statusLabel(statut),
      responsable: responsable || null,
      reporte_jusqu_au: jour(this.reports.get(`${TYPES[type][2]}:${o.id}`)),
      lien: this.base + chemin,
      ...autres,
    };
  }
}

async function contexte(): Promise<Contexte> {
  const tout = await chargerTout();
  const today = aujourdhui();
  const [snoozes, logiciels, ct] = await Promise.all([
    prisma.alertSnooze.findMany({ where: { snoozedUntil: { gte: today } } }),
    prisma.software.findMany({ select: { id: true, name: true } }),
    prisma.ctLogEntry.groupBy({
      by: ["domainId"],
      where: { status: "new" },
      _count: { _all: true },
    }),
  ]);
  return new Contexte(
    tout,
    new Map(snoozes.map((s) => [`${s.entityType}:${s.entityId}`, s.snoozedUntil])),
    (tout.settings.APP_BASE_URL || "").replace(/\/+$/, ""),
    new Map(logiciels.map((s) => [s.id, s.name])),
    new Map(ct.map((c) => [c.domainId, c._count._all])),
  );
}

const nomDe = (lie: { name: string } | null | undefined) => lie?.name ?? null;
const d = (v: Date | null | undefined, passe?: string, futur?: string, today?: Date) =>
  delai(v, passe, futur, today);

// ── une fiche → ses éléments ──

type Compte = Tout["accounts"][number];
type Certificat = Tout["certificates"][number];
type Domaine = Tout["domains"][number];
type Sauvegarde = Tout["backups"][number];
type Test = Tout["tests"][number];
type Revue = Tout["reviews"][number];
type MiseAJour = Tout["updates"][number];
type Contrat = Tout["contracts"][number];
type Materiel = Tout["equipments"][number];
type Logiciel = Tout["software"][number];

function compte(a: Compte, ctx: Contexte): Element[] {
  const dt = a.nextPasswordChange;
  return [
    ctx.element(
      "mot_de_passe",
      a,
      `${a.serviceName} (${a.username})`,
      `/accounts/${a.id}`,
      a.status,
      {
        objet: "Rotation du mot de passe",
        echeance: dt,
        type_libelle: "Mot de passe",
        detail: dt
          ? `Mot de passe à renouveler ${d(dt, undefined, undefined, ctx.aujourdhui)}`
          : "Date de rotation non renseignée",
      },
    ),
  ];
}

function certificat(c: Certificat, ctx: Contexte): Element[] {
  const autres: Record<string, unknown> = {};
  if (c.kind === "signature" && certificateHolderLabel(c))
    autres.titulaire = certificateHolderLabel(c);
  let detail: string;
  if (c.validity === "revoque") detail = "Certificat révoqué : hors surveillance";
  else if (c.expiryDate)
    detail = `Certificat ${d(c.expiryDate, "expiré depuis", "expire dans", ctx.aujourdhui)}`;
  else detail = "Date d'expiration à compléter";
  return [
    ctx.element("certificat", c, certificateLabel(c), `/certificates/${c.id}`, c.status, {
      objet: "Expiration du certificat",
      echeance: c.expiryDate,
      type_libelle: CERT_KIND_LABELS[c.kind] ?? c.kind ?? "",
      detail,
      ...autres,
    }),
  ];
}

function domaine(dm: Domaine, ctx: Contexte): Element[] {
  return [
    ctx.element("domaine", dm, dm.name, `/domains/${dm.id}`, dm.status, {
      objet: "Expiration du nom de domaine",
      echeance: dm.expiryDate,
      type_libelle: "Domaine",
      detail: dm.expiryDate
        ? `Domaine ${d(dm.expiryDate, "expiré depuis", "expire dans", ctx.aujourdhui)}`
        : "Date d'expiration à compléter",
    }),
  ];
}

function joursDepuisDernierOk(b: Sauvegarde, today: Date): number | null {
  const dernier = backupLastOkCheck(b.checks);
  return dernier ? Math.floor((today.getTime() - dernier.checkDate.getTime()) / 86_400_000) : null;
}

function sauvegarde(b: Sauvegarde, ctx: Contexte): Element[] {
  const dernier = backupLastOkCheck(b.checks);
  // Le contrôle réussi suivant était attendu une période après le dernier.
  const attendu = dernier
    ? new Date(dernier.checkDate.getTime() + backupExpectedIntervalDays(b.frequency) * 86_400_000)
    : null;
  const duJour = backupTodayCheck(b.checks, ctx.aujourdhui);
  let detail: string;
  if (duJour && duJour.status === "failed") detail = "Contrôle du jour en échec";
  else if (duJour && duJour.status === "warning") detail = "Contrôle du jour en avertissement";
  else if (!dernier) detail = "Aucun contrôle réussi enregistré";
  else
    detail = `Dernier contrôle réussi il y a ${joursDepuisDernierOk(b, ctx.aujourdhui)} j (${frequenceLabel(b).toLowerCase()})`;
  return [
    ctx.element("sauvegarde", b, b.serviceName, `/backups/${b.id}`, b.status, {
      objet: "Vérification de la sauvegarde",
      echeance: attendu,
      type_libelle: "Sauvegarde",
      detail,
    }),
  ];
}

function frequenceLabel(b: { frequency: string | null }): string {
  return FREQ_LABELS[b.frequency ?? ""] ?? b.frequency ?? "Non definie";
}

function test(t: Test, ctx: Contexte): Element[] {
  let detail = t.nextDue
    ? `Test ${d(t.nextDue, undefined, "à faire dans", ctx.aujourdhui)}`
    : "Échéance non planifiée";
  if (t.brut === "failed") detail += " — dernier passage en échec";
  return [
    ctx.element("test", t, t.name, `/tests/${t.id}`, t.status, {
      objet: t.testType ? `Test à effectuer (${t.testType})` : "Test à effectuer",
      echeance: t.nextDue,
      type_libelle: "Test récurrent",
      detail,
    }),
  ];
}

function revue(r: Revue, ctx: Contexte): Element[] {
  return [
    ctx.element("revue", r, r.application, `/reviews/${r.id}`, r.status, {
      objet: "Revue des droits d'accès",
      echeance: r.nextReview,
      type_libelle: "Revue de droits",
      responsable: r.responsible,
      detail: r.nextReview
        ? `Revue ${d(r.nextReview, undefined, undefined, ctx.aujourdhui)}`
        : "Revue à planifier",
    }),
  ];
}

function miseAJour(u: MiseAJour, ctx: Contexte): Element[] {
  const versions = [u.currentVersion, u.latestVersion].filter(Boolean).join(" → ");
  const detail = (ETATS_MAJ[u.brut ?? ""] ?? u.brut ?? "") + (versions ? ` (${versions})` : "");
  return [
    ctx.element("mise_a_jour", u, u.name, `/updates/${u.id}`, u.status, {
      objet: "Mise à jour",
      type_libelle: "Mise à jour",
      detail,
    }),
  ];
}

function contrat(c: Contrat, ctx: Contexte): Element[] {
  const limite = contractActionDeadline(c);
  let detail: string;
  if (!limite) detail = "Échéance à renseigner";
  else {
    const txt = d(limite, "préavis dépassé de", "agir dans", ctx.aujourdhui);
    detail = txt.charAt(0).toUpperCase() + txt.slice(1);
    detail += ` (fin du contrat le ${c.endDate ? dateCourte(c.endDate) : "?"}`;
    detail += c.noticeDays ? `, préavis ${c.noticeDays} j)` : ")";
  }
  return [
    ctx.element("contrat", c, c.name, `/contracts/${c.id}`, c.status, {
      objet: "Échéance / préavis du contrat",
      echeance: limite,
      type_libelle: "Contrat",
      detail,
      fournisseur: nomDe(c.supplier),
    }),
  ];
}

const kindLabel = (e: { kind: string }) => EQUIPMENT_KIND_LABELS[e.kind] ?? e.kind;

/** Fin de garantie et fin de support de l'OS (cache local d'endoflife.date : aucun appel réseau). */
function materiel(e: Materiel, ctx: Contexte): Element[] {
  const elements: Element[] = [];
  const chemin = `/inventory/${e.id}`;
  if (e.warrantyEnd) {
    elements.push(
      ctx.element(
        "materiel",
        e,
        `${e.name} (garantie)`,
        chemin,
        warrantyStatus(e, ctx.tout.seuils, ctx.aujourdhui) ?? "info",
        {
          objet: "Fin de garantie matérielle",
          echeance: e.warrantyEnd,
          type_libelle: kindLabel(e),
          detail: `Garantie ${d(e.warrantyEnd, "expirée depuis", "expire dans", ctx.aujourdhui)}`,
        },
      ),
    );
  }
  const info = e.eol;
  if (info?.eol_date) {
    const systeme = [e.os, e.osVersion].filter(Boolean).join(" ");
    elements.push(
      ctx.element("materiel", e, `${e.name} (fin de support OS)`, chemin, info.status || "info", {
        objet: "Fin de support du système d'exploitation",
        echeance: info.eol_date,
        type_libelle: kindLabel(e),
        detail: `${systeme} : fin de support ${d(info.eol_date, "dépassée de", "dans", ctx.aujourdhui)}`,
      }),
    );
  }
  return elements;
}

function logiciel(s: Logiciel, ctx: Contexte): Element[] {
  let detail: string;
  if (s.status === "danger") detail = "Mise à jour critique en attente";
  else if (s.lifecycle === "fin_de_vie") detail = "En fin de vie, successeur à trouver";
  else if (s.status === "warning") detail = "Mise à jour disponible";
  else detail = lifecycleLabel(s);
  return [
    ctx.element("logiciel", s, s.name, `/inventory/logiciels/${s.id}`, s.status, {
      objet: "Cycle de vie du logiciel",
      type_libelle: "Logiciel",
      responsable: s.responsible,
      detail,
    }),
  ];
}

type Fiche = { id: number; status: string };
type Source = {
  fiches: (ctx: Contexte) => Fiche[];
  construire: (o: Fiche, ctx: Contexte) => Element[];
};
const S = (
  fiches: (ctx: Contexte) => Fiche[],
  // biome-ignore lint/suspicious/noExplicitAny: les constructeurs sont typés par source ; la table les unifie.
  construire: (o: any, ctx: Contexte) => Element[],
): Source => ({ fiches, construire });
const SOURCES: Record<string, Source> = {
  mot_de_passe: S((ctx) => ctx.tout.accounts, compte),
  certificat: S((ctx) => ctx.tout.certificates, certificat),
  domaine: S((ctx) => ctx.tout.domains, domaine),
  sauvegarde: S((ctx) => ctx.tout.backups, sauvegarde),
  test: S((ctx) => ctx.tout.tests, test),
  revue: S((ctx) => ctx.tout.reviews, revue),
  mise_a_jour: S((ctx) => ctx.tout.updates, miseAJour),
  contrat: S((ctx) => ctx.tout.contracts, contrat),
  materiel: S((ctx) => ctx.tout.equipments, materiel),
  logiciel: S((ctx) => ctx.tout.software, logiciel),
};
/** Échéances d'ÉTAT : retenues sur leur statut, pas sur une date. */
const PAR_ETAT = new Set(["sauvegarde", "mise_a_jour", "logiciel"]);

function actifs(ctx: Contexte, types?: string[] | null): string[] {
  return (types?.length ? types : Object.keys(TYPES)).filter((t) =>
    categoryEnabledIn(ctx.tout.settings, TYPES[t][1]),
  );
}

function retenue(type: string, o: Fiche, el: Element, limite: string): boolean {
  if (type === "logiciel") return (o as Logiciel).lifecycle === "fin_de_vie";
  if (PAR_ETAT.has(type)) return el.statut === "danger" || el.statut === "warning";
  if (type === "certificat" && !certificateMonitored(o as Certificat)) return false;
  return el.echeance !== null && el.echeance <= limite;
}

const rang = (s: string) => {
  const i = (STATUTS as readonly string[]).indexOf(s);
  return i < 0 ? 9 : i;
};

// ── routes ──

/** Ce qui arrive à échéance dans `dans` jours, ou est déjà en retard. */
export async function echeances(dans = HORIZON_DEFAUT, types?: string[] | null) {
  const ctx = await contexte();
  const limite = new Date(ctx.aujourdhui.getTime() + dans * 86_400_000);
  const limiteIso = limite.toISOString().slice(0, 10);
  const retenus: Element[] = [];
  const typesActifs = actifs(ctx, types);
  for (const t of typesActifs) {
    const { fiches, construire } = SOURCES[t];
    for (const o of fiches(ctx))
      retenus.push(...construire(o, ctx).filter((el) => retenue(t, o, el, limiteIso)));
  }
  retenus.sort(
    (a, b) =>
      (a.echeance ?? "").localeCompare(b.echeance ?? "") ||
      rang(a.statut) - rang(b.statut) ||
      a.nom.toLowerCase().localeCompare(b.nom.toLowerCase()),
  );
  return {
    genere_le: maintenant(),
    aujourd_hui: jour(ctx.aujourdhui),
    dans,
    jusqu_au: limiteIso,
    types: typesActifs,
    total: retenus.length,
    en_retard: retenus.filter((e) => e.en_retard).length,
    tronque: retenus.length > ELEMENTS_MAX,
    elements: retenus.slice(0, ELEMENTS_MAX),
  };
}

/** L'élément qui présente une fiche trouvée. Le matériel se présente par son statut d'ensemble. */
function fiche(type: string, o: Fiche, ctx: Contexte): Element {
  if (type === "materiel") {
    const e = o as Materiel;
    return ctx.element("materiel", e, e.name, `/inventory/${e.id}`, e.status, {
      objet: "Fin de garantie matérielle",
      echeance: e.warrantyEnd,
      type_libelle: kindLabel(e),
      detail: e.reasons.join("; ") || statusLabel(e.status),
    });
  }
  return SOURCES[type].construire(o, ctx)[0];
}

/** Les alertes ouvertes, une par fiche critique ou urgente, hors alertes reportées (sauf `reportees`). */
export async function alertes(types?: string[] | null, reportees = false) {
  const ctx = await contexte();
  const retenus: Element[] = [];
  const typesActifs = actifs(ctx, types);
  for (const t of typesActifs) {
    for (const o of SOURCES[t].fiches(ctx)) {
      const s = o.status;
      if (s !== "danger" && s !== "warning") continue;
      if (ctx.reports.has(`${TYPES[t][2]}:${o.id}`) && !reportees) continue;
      retenus.push({ ...fiche(t, o, ctx), statut: s, statut_libelle: statusLabel(s) });
    }
  }
  retenus.sort(
    (a, b) =>
      rang(a.statut) - rang(b.statut) ||
      Number(a.echeance === null) - Number(b.echeance === null) ||
      (a.echeance ?? "").localeCompare(b.echeance ?? "") ||
      a.nom.toLowerCase().localeCompare(b.nom.toLowerCase()),
  );
  return {
    genere_le: maintenant(),
    aujourd_hui: jour(ctx.aujourdhui),
    types: typesActifs,
    reportees_incluses: Boolean(reportees),
    total: retenus.length,
    critiques: retenus.filter((e) => e.statut === "danger").length,
    urgentes: retenus.filter((e) => e.statut === "warning").length,
    tronque: retenus.length > ELEMENTS_MAX,
    elements: retenus.slice(0, ELEMENTS_MAX),
  };
}

/** Comptes par type et par statut, conformité globale et alertes : ce que disent le tableau de bord et le récapitulatif du matin. */
export async function synthese() {
  const ctx = await contexte();
  const categories: {
    type: string;
    libelle: string;
    total: number;
    par_statut: Record<string, number>;
  }[] = [];
  const aTraiter: Record<string, { critiques: number; urgents: number }> = {};
  for (const t of actifs(ctx)) {
    const compteurs: Record<string, number> = { danger: 0, warning: 0, info: 0, success: 0 };
    let critiques = 0;
    let urgents = 0;
    for (const o of SOURCES[t].fiches(ctx)) {
      const s = o.status in compteurs ? o.status : "info";
      compteurs[s] += 1;
      // Une alerte reportée n'est plus « ouverte » : quelqu'un l'a vue.
      if (!ctx.reports.has(`${TYPES[t][2]}:${o.id}`)) {
        if (o.status === "danger") critiques += 1;
        if (o.status === "warning") urgents += 1;
      }
    }
    categories.push({
      type: t,
      libelle: TYPES[t][0],
      total: Object.values(compteurs).reduce((a, b) => a + b, 0),
      par_statut: compteurs,
    });
    if (critiques || urgents) aTraiter[t] = { critiques, urgents };
  }
  const retenues = new Set<string>(await getConformityCategories());
  const comptees = categories.filter((c) => retenues.has(TYPES[c.type][1]));
  const total = comptees.reduce((a, c) => a + c.total, 0);
  const ok = comptees.reduce((a, c) => a + c.par_statut.success, 0);

  const depuis = new Date(Date.now() - 7 * 86_400_000);
  const [envoyees, echecs, dernieres, tache] = await Promise.all([
    prisma.alertLog.count({ where: { sentAt: { gte: depuis }, status: "sent" } }),
    prisma.alertLog.count({ where: { sentAt: { gte: depuis }, status: "failed" } }),
    prisma.alertLog.findMany({ orderBy: { sentAt: "desc" }, take: 5 }),
    prisma.schedulerRun.findFirst({ orderBy: { runAt: "desc" } }),
  ]);
  const totaux: Record<string, number> = Object.fromEntries(
    STATUTS.map((s) => [s, categories.reduce((a, c) => a + c.par_statut[s], 0)]),
  );
  totaux.total = categories.reduce((a, c) => a + c.total, 0);
  const valeurs = Object.values(aTraiter);
  return {
    genere_le: maintenant(),
    aujourd_hui: jour(ctx.aujourdhui),
    categories,
    totaux,
    conformite: total ? Math.round((100 * ok) / total) : 100,
    alertes: {
      ouvertes: valeurs.reduce((a, v) => a + v.critiques + v.urgents, 0),
      critiques: valeurs.reduce((a, v) => a + v.critiques, 0),
      urgentes: valeurs.reduce((a, v) => a + v.urgents, 0),
      par_type: aTraiter,
      reportees: ctx.reports.size,
      envoyees_7_jours: envoyees,
      echecs_7_jours: echecs,
      // Ni le message (il peut porter l'erreur SMTP), ni les destinataires.
      dernieres: dernieres.map((a) => ({
        date: horodatage(a.sentAt),
        type: PAR_ENTITE[a.entityType ?? ""] ?? a.entityType,
        nom: a.entityName,
        envoyee: a.status === "sent",
      })),
    },
    derniere_tache_planifiee: horodatage(tache?.runAt),
    lien: `${ctx.base}/`,
  };
}

/** Où chercher, par type : les noms, et les personnes ou sociétés nommées sur la fiche. Jamais les textes libres. */
function chercheDans(type: string, o: Fiche, ctx: Contexte): (string | null | undefined)[] {
  switch (type) {
    case "mot_de_passe": {
      const a = o as Compte;
      return [a.serviceName, a.username, a.softwareId ? ctx.logiciels.get(a.softwareId) : null];
    }
    case "certificat": {
      const c = o as Certificat;
      return [c.serviceName, c.domain, c.holder, c.firstName, c.issuer, nomDe(c.supplier)];
    }
    case "domaine": {
      const dm = o as Domaine;
      return [dm.name, dm.registrar];
    }
    case "sauvegarde": {
      const b = o as Sauvegarde;
      return [b.serviceName, b.backupType, nomEquipement(b.equipmentId, ctx)];
    }
    case "test": {
      const t = o as Test;
      return [t.name, t.testType, nomDe(t.software)];
    }
    case "revue": {
      const r = o as Revue;
      return [r.application, r.responsible];
    }
    case "contrat": {
      const c = o as Contrat;
      return [c.name, c.reference, nomDe(c.supplier)];
    }
    case "logiciel": {
      const s = o as Logiciel;
      return [s.name, s.responsible, nomDe(s.supplier)];
    }
    default:
      return [(o as unknown as { name: string }).name]; // mise_a_jour, materiel
  }
}

function nomEquipement(id: number | null, ctx: Contexte): string | null {
  return id ? (ctx.tout.equipments.find((e) => e.id === id)?.name ?? null) : null;
}

/** Ce que la fiche dit d'utile, sans secret ni texte libre. */
function details(type: string, o: Fiche, ctx: Contexte): Record<string, unknown> {
  switch (type) {
    case "mot_de_passe": {
      const a = o as Compte;
      return {
        identifiant: a.username,
        service: a.serviceName,
        derniere_rotation: jour(a.lastPasswordChange),
        rotation_jours: a.rotationDays,
        logiciel: a.softwareId ? (ctx.logiciels.get(a.softwareId) ?? null) : null,
      };
    }
    case "certificat": {
      const c = o as Certificat;
      // Ni code de révocation (secret opératoire), ni montant, ni imputation.
      return {
        nature: CERT_KIND_LABELS[c.kind] ?? c.kind ?? "",
        domaine: c.domain,
        emetteur: c.issuer,
        autorite: nomDe(c.supplier),
        renouvellement_auto: Boolean(c.autoRenew),
        validite: CERT_VALIDITY_LABELS[c.validity ?? ""] ?? "Valide",
        titulaire: certificateHolderLabel(c) || null,
        qualite: c.holderRole,
        usage: certificateUsageLabel(c) || null,
        support: certificateSupportLabel(c) || null,
        niveau: c.level,
      };
    }
    case "domaine": {
      const dm = o as Domaine;
      return {
        bureau_enregistrement: dm.registrar,
        renouvellement_auto: Boolean(dm.autoRenew),
        surveillance_ct: Boolean(dm.ctEnabled),
        certificats_ct_nouveaux: ctx.ctNouveaux.get(dm.id) ?? 0,
      };
    }
    case "sauvegarde": {
      const b = o as Sauvegarde;
      const dernier = backupLastOkCheck(b.checks);
      return {
        type: b.backupType,
        frequence: frequenceLabel(b),
        dernier_controle_reussi: jour(dernier?.checkDate),
        taux_reussite_30_jours: backupSuccessRate(b.checks),
        equipement: nomEquipement(b.equipmentId, ctx),
      };
    }
    case "test": {
      const t = o as Test;
      return {
        nature: t.testType,
        dernier_passage: jour(t.lastPerformed),
        frequence_jours: t.frequencyDays,
        etat: ETATS_TACHE[t.brut ?? ""] ?? t.brut,
        logiciel: nomDe(t.software),
      };
    }
    case "revue": {
      const r = o as Revue;
      return {
        derniere_revue: jour(r.lastReview),
        frequence_jours: r.frequencyDays,
        etat: ETATS_TACHE[r.brut ?? ""] ?? r.brut,
        logiciel: nomDe(r.software),
      };
    }
    case "mise_a_jour": {
      const u = o as MiseAJour;
      return {
        version_actuelle: u.currentVersion,
        version_disponible: u.latestVersion,
        etat: ETATS_MAJ[u.brut ?? ""] ?? u.brut,
        derniere_mise_a_jour: jour(u.lastUpdate),
        logiciel: nomDe(u.software),
        equipement: nomDe(u.equipment),
      };
    }
    case "contrat": {
      const c = o as Contrat;
      return {
        type: contractKindLabel(c) || null,
        nature: CONTRACT_NATURE_LABELS[c.nature ?? ""] || null,
        fournisseur: nomDe(c.supplier),
        reference: c.reference,
        debut: jour(c.startDate),
        fin: jour(c.endDate),
        preavis_jours: c.noticeDays,
        tacite_reconduction: Boolean(c.autoRenew),
        date_limite_action: jour(contractActionDeadline(c)),
      };
    }
    case "materiel": {
      const e = o as Materiel;
      return {
        nature: kindLabel(e),
        environnement: ENVIRONMENT_LABELS[e.environment ?? ""] || null,
        criticite: e.criticality ? (CRITICALITY_LABELS[e.criticality] ?? null) : null,
        fin_garantie: jour(e.warrantyEnd),
        systeme: [e.os, e.osVersion].filter(Boolean).join(" ") || null,
        fin_support_systeme: jour(e.eol?.eol_date),
        points_attention: e.reasons,
      };
    }
    case "logiciel": {
      const s = o as Logiciel;
      return {
        version: s.version,
        cycle_de_vie: lifecycleLabel(s),
        hebergement: hostingLabel(s),
        editeur: nomDe(s.supplier),
        criticite: criticalityLabel(s) || null,
        responsable_technique: s.techResponsible,
      };
    }
    default:
      return {};
  }
}

/** Fiches dont le nom (ou une personne, une société nommée) contient `q`, sans tenir compte des accents ni des majuscules. */
export async function recherche(q: string, types?: string[] | null) {
  const ctx = await contexte();
  const cle = simplifier(q);
  const trouvees: [string, Fiche][] = [];
  for (const t of actifs(ctx, types)) {
    for (const o of SOURCES[t].fiches(ctx)) {
      if (chercheDans(t, o, ctx).some((v) => v && simplifier(v).includes(cle)))
        trouvees.push([t, o]);
    }
  }
  const elements = trouvees
    .slice(0, RESULTATS_MAX)
    .map(([t, o]) => ({ ...fiche(t, o, ctx), details: details(t, o, ctx) }));
  return {
    genere_le: maintenant(),
    q,
    total: trouvees.length,
    tronque: trouvees.length > RESULTATS_MAX,
    elements,
  };
}
