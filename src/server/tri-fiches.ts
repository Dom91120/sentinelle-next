/**
 * L'ordre des fiches : le même dans la liste et sous les chevrons précédente / suivante
 * de la fiche, pour feuilleter dans l'ordre où l'on vient de lire.
 *
 * Fiches à échéance (comptes, certificats, domaines, contrats, sauvegardes, tests, mises à
 * jour, revues) : le plus urgent en tête — par statut (rouge, orange, bleu, vert), puis par
 * la date qui fait ce statut (la plus proche d'abord, « à renseigner » devant), puis par nom.
 * Fiches sans échéance (matériel, logiciels, fournisseurs) : l'ordre alphabétique français
 * du nom, sans distinction de casse ni d'accents.
 */
import { type Statut, statusRank } from "@/lib/constantes";
import { aujourdhui } from "@/lib/libelles";
import {
  type BackupCheckLike,
  backupExpectedIntervalDays,
  backupLastOkCheck,
  type ContractLike,
  contractDaysLeft,
} from "@/lib/statuts";

export type Ordre<T> = (a: T, b: T) => number;

/** Les critères dans l'ordre : le suivant départage les ex æquo du précédent. */
export function enchainer<T>(...ordres: Ordre<T>[]): Ordre<T> {
  return (a, b) => {
    for (const ordre of ordres) {
      const r = ordre(a, b);
      if (r) return r;
    }
    return 0;
  };
}

/** Alphabétique français, sans distinction de casse ni d'accents. */
export function parNom<T>(nom: (x: T) => string | null | undefined): Ordre<T> {
  return (a, b) => (nom(a) ?? "").localeCompare(nom(b) ?? "", "fr", { sensitivity: "base" });
}

function parStatut<T>(statut: (x: T) => Statut | string | null | undefined): Ordre<T> {
  return (a, b) => statusRank(statut(a)) - statusRank(statut(b));
}

/** Croissant ; une valeur absente passe devant (« à renseigner »). */
function parNombre<T>(valeur: (x: T) => number | null | undefined): Ordre<T> {
  return (a, b) => {
    const x = valeur(a);
    const y = valeur(b);
    if (x == null || y == null) return (x == null ? 0 : 1) - (y == null ? 0 : 1);
    return x - y;
  };
}

function parDate<T>(date: (x: T) => Date | null | undefined): Ordre<T> {
  return parNombre((x) => date(x)?.getTime());
}

const parId: Ordre<{ id: number }> = (a, b) => a.id - b.id;

type Fiche = { id: number };
type FicheStatut = Fiche & { status: Statut };

// ── Fiches à échéance : le plus urgent en tête ──

export const triComptes = enchainer<
  FicheStatut & { nextPasswordChange: Date | null; serviceName: string }
>(
  parStatut((a) => a.status),
  parDate((a) => a.nextPasswordChange),
  parNom((a) => a.serviceName),
  parId,
);

export const triCertificats = enchainer<
  FicheStatut & { expiryDate: Date | null; serviceName: string }
>(
  parStatut((c) => c.status),
  parDate((c) => c.expiryDate),
  parNom((c) => c.serviceName),
  parId,
);

export const triDomaines = enchainer<FicheStatut & { expiryDate: Date | null; name: string }>(
  parStatut((d) => d.status),
  parDate((d) => d.expiryDate),
  parNom((d) => d.name),
  parId,
);

/** Par nombre de jours restants (la colonne Statut de la liste). */
export function triContrats(today = aujourdhui()) {
  return enchainer<FicheStatut & ContractLike & { name: string }>(
    parStatut((c) => c.status),
    parNombre((c) => contractDaysLeft(c, today)),
    parNom((c) => c.name),
    parId,
  );
}

/** La date à laquelle la sauvegarde devait retourner : dernier pointage OK + période. */
export function backupProchaineDate(b: {
  frequency: string | null;
  checks: BackupCheckLike[];
}): Date | null {
  const dernierOk = backupLastOkCheck(b.checks);
  if (!dernierOk) return null;
  const jours = backupExpectedIntervalDays(b.frequency);
  return new Date(dernierOk.checkDate.getTime() + jours * 86_400_000);
}

export const triSauvegardes = enchainer<
  FicheStatut & { frequency: string | null; checks: BackupCheckLike[]; serviceName: string }
>(
  parStatut((b) => b.status),
  parDate(backupProchaineDate),
  parNom((b) => b.serviceName),
  parId,
);

export const triTests = enchainer<FicheStatut & { nextDue: Date | null; name: string }>(
  parStatut((t) => t.status),
  parDate((t) => t.nextDue),
  parNom((t) => t.name),
  parId,
);

/** Par date de dernière mise à jour, la plus ancienne (ou absente) en tête. */
export const triMisesAJour = enchainer<FicheStatut & { lastUpdate: Date | null; name: string }>(
  parStatut((u) => u.status),
  parDate((u) => u.lastUpdate),
  parNom((u) => u.name),
  parId,
);

export const triRevues = enchainer<FicheStatut & { nextReview: Date | null; application: string }>(
  parStatut((r) => r.status),
  parDate((r) => r.nextReview),
  parNom((r) => r.application),
  parId,
);

// ── Fiches sans échéance : l'ordre alphabétique du nom ──

export const triNoms = enchainer<Fiche & { name: string }>(
  parNom((x) => x.name),
  parId,
);
