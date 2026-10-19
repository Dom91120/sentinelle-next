/**
 * Le contexte d'une page de module : `contextePage()` + `view_guard(categorie)`
 * (+ `features.require` pour un module débrayable, lecture comprise).
 */
import { notFound, redirect } from "next/navigation";
import type { PermissionCategory } from "@/lib/constantes";
import { prisma } from "@/server/db";
import { type FeatureName, MODULE_CATEGORIES, enabledIn } from "@/server/features";
import { flash } from "@/server/flash";
import { contextePage, type Page } from "@/server/page";
import type { Voisins } from "@/server/voisins";
import { voisinsParmi } from "@/server/voisins";

export async function contexteModule(category: PermissionCategory): Promise<Page> {
  const page = await contextePage();
  for (const [name, cat] of Object.entries(MODULE_CATEGORIES)) {
    if (cat === category && !enabledIn(page.user.settings, name as FeatureName)) notFound();
  }
  if (!page.user.canView(category)) {
    await flash("Acces non autorise a cette section.", "danger");
    redirect("/");
  }
  return page;
}

/** `voisins(modele, fiche, cle)` : (précédente, suivante) parmi les fiches actives, triées par nom. */
export async function voisinsDe(
  table: "account" | "certificate" | "domain" | "backup" | "testTask" | "accessReview" | "systemUpdate" | "equipment" | "software" | "supplier" | "contract",
  id: number,
  champ: string,
  page: Page,
): Promise<Voisins> {
  if (!page.user.settings.FICHE_NAVIGATION) return [null, null];
  const rows = (await (prisma[table] as unknown as { findMany: (a: unknown) => Promise<Record<string, unknown>[]> }).findMany({
    where: { isActive: true },
    select: { id: true, [champ]: true },
  })) as { id: number; [k: string]: unknown }[];
  return voisinsParmi(
    rows.map((r) => ({ id: r.id, nom: String(r[champ] ?? "") })),
    id,
    page.user.settings,
  );
}
