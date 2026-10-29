/**
 * Le contexte d'une page de module : `contextePage()` + `view_guard(categorie)`
 * (+ `features.require` pour un module débrayable, lecture comprise).
 */
import { notFound } from "next/navigation";
import type { PermissionCategory } from "@/lib/constantes";
import type { Seuils } from "@/lib/statuts";
import { type AppSettings, seuilsDe } from "@/server/config-store";
import { prisma } from "@/server/db";
import {
  chargerCertificats,
  chargerComptes,
  chargerContrats,
  chargerDomaines,
  chargerMisesAJour,
  chargerRevues,
  chargerSauvegardes,
  chargerTests,
} from "@/server/donnees";
import { enabledIn, type FeatureName, MODULE_CATEGORIES } from "@/server/features";
import { redirigerAvecFlashDepuisRendu } from "@/server/flash";
import { contextePage, type Page } from "@/server/page";
import {
  triCertificats,
  triComptes,
  triContrats,
  triDomaines,
  triMisesAJour,
  triNoms,
  triRevues,
  triSauvegardes,
  triTests,
} from "@/server/tri-fiches";
import type { Voisins } from "@/server/voisins";
import { voisinsParmi } from "@/server/voisins";

export async function contexteModule(category: PermissionCategory): Promise<Page> {
  const page = await contextePage();
  for (const [name, cat] of Object.entries(MODULE_CATEGORIES)) {
    if (cat === category && !enabledIn(page.user.settings, name as FeatureName)) notFound();
  }
  if (!page.user.canView(category)) {
    redirigerAvecFlashDepuisRendu("/", "Acces non autorise a cette section.", "danger");
  }
  return page;
}

export type TableVoisins =
  | "account"
  | "certificate"
  | "domain"
  | "backup"
  | "testTask"
  | "accessReview"
  | "systemUpdate"
  | "equipment"
  | "software"
  | "supplier"
  | "contract";

type Nomme = { id: number; nom: string };
const nommes = <T extends { id: number }>(rows: T[], nom: (r: T) => string): Nomme[] =>
  rows.map((r) => ({ id: r.id, nom: nom(r) }));
const parNom = (table: "equipment" | "software" | "supplier") => async () => {
  const rows = await (
    prisma[table] as unknown as {
      findMany: (a: unknown) => Promise<{ id: number; name: string }[]>;
    }
  ).findMany({ where: { isActive: true }, select: { id: true, name: true } });
  return nommes(rows.sort(triNoms), (r) => r.name);
};

/** Les fiches actives de chaque module, dans l'ordre de sa liste (`tri-fiches.ts`). */
const LISTES: Record<TableVoisins, (seuils: Seuils, settings: AppSettings) => Promise<Nomme[]>> = {
  account: async (seuils) =>
    nommes((await chargerComptes(seuils)).sort(triComptes), (a) => a.serviceName),
  certificate: async (seuils, settings) =>
    nommes((await chargerCertificats(seuils, settings)).sort(triCertificats), (c) => c.serviceName),
  domain: async (seuils) =>
    nommes((await chargerDomaines(seuils)).sort(triDomaines), (d) => d.name),
  contract: async (seuils) =>
    nommes((await chargerContrats(seuils)).sort(triContrats()), (c) => c.name),
  backup: async () =>
    nommes((await chargerSauvegardes()).sort(triSauvegardes), (b) => b.serviceName),
  testTask: async (seuils) => nommes((await chargerTests(seuils)).sort(triTests), (t) => t.name),
  systemUpdate: async () => nommes((await chargerMisesAJour()).sort(triMisesAJour), (u) => u.name),
  accessReview: async (seuils) =>
    nommes((await chargerRevues(seuils)).sort(triRevues), (r) => r.application),
  equipment: parNom("equipment"),
  software: parNom("software"),
  supplier: parNom("supplier"),
};

/** `voisins(modele, fiche)` : (précédente, suivante) parmi les fiches actives, dans l'ordre de la liste. */
export async function voisinsDe(table: TableVoisins, id: number, page: Page): Promise<Voisins> {
  const { settings } = page.user;
  if (!settings.FICHE_NAVIGATION) return [null, null];
  return voisinsParmi(await LISTES[table](seuilsDe(settings), settings), id, settings);
}
