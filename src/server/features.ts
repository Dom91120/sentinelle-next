/**
 * Modules débrayables depuis Préférences (port de app/features.py).
 *
 * Chaque module a son interrupteur, persisté par config-store (clé MANAGED et
 * BOOL), avec un repli .env et un défaut à « actif ». Désactivé, un module
 * disparaît des écrans et ses routes d'écriture répondent 404 ; les données
 * déjà saisies restent en base.
 */
import { notFound } from "next/navigation";
import type { PermissionCategory } from "@/lib/constantes";
import { type AppSettings, getSettings } from "@/server/config-store";

export type FeatureName = "quotes" | "gdpr" | "links" | "certificates";

/** nom court → (clé de configuration, libellé, aide) */
export const FEATURES: Record<FeatureName, [string, string, string]> = {
  quotes: [
    "QUOTES_ENABLED",
    "Devis et consultations",
    "Mise en concurrence sur la fiche logiciel : consultations, devis reçus, devis retenu.",
  ],
  gdpr: [
    "GDPR_ENABLED",
    "Volet RGPD",
    "Données personnelles traitées par chaque logiciel : catégories, référence au registre, localisation.",
  ],
  links: [
    "SOFTWARE_LINKS_ENABLED",
    "Flux entre logiciels",
    "Interconnexions déclarées d'un logiciel à l'autre : qui alimente qui.",
  ],
  certificates: [
    "CERTIFICATES_ENABLED",
    "Certificats",
    "Certificats TLS des serveurs et certificats électroniques (carte, clé, fichier) des élus " +
      "et des agents. Désactivé, le menu, les fiches, les échéances et les alertes de certificats " +
      "disparaissent ; les données restent en base.",
  ],
};

/** Un module qui est un ÉCRAN ENTIER se coupe par sa catégorie de droit. */
export const MODULE_CATEGORIES: Record<string, PermissionCategory> = { certificates: "certificates" };

export const CONFIG_KEYS = new Set(Object.values(FEATURES).map(([k]) => k));

export type FeatureFlags = Record<FeatureName, boolean>;

/** Le module est-il actif ? Défaut : oui. */
export function enabledIn(settings: AppSettings, name: FeatureName): boolean {
  const key = FEATURES[name][0];
  const v = settings[key];
  return v === undefined ? true : Boolean(v);
}

export async function enabled(name: FeatureName): Promise<boolean> {
  return enabledIn(await getSettings(), name);
}

/** La catégorie de droit relève-t-elle d'un module actif ? */
export function categoryEnabledIn(settings: AppSettings, category: string): boolean {
  return Object.entries(MODULE_CATEGORIES).every(
    ([name, cat]) => cat !== category || enabledIn(settings, name as FeatureName),
  );
}

/** À poser en tête d'une route d'écriture : un module coupé n'accepte plus rien. */
export async function require(name: FeatureName): Promise<void> {
  if (!(await enabled(name))) notFound();
}

/** {nom: actif} pour les gabarits (`features.quotes`…). */
export function allFlagsIn(settings: AppSettings): FeatureFlags {
  return Object.fromEntries(
    (Object.keys(FEATURES) as FeatureName[]).map((n) => [n, enabledIn(settings, n)]),
  ) as FeatureFlags;
}

export async function allFlags(): Promise<FeatureFlags> {
  return allFlagsIn(await getSettings());
}
