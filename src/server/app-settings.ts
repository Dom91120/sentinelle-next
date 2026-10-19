/**
 * Réglages applicatifs simples (table setting, clé/valeur) — port de app/app_settings.py.
 * Catégories prises en compte dans la « Conformité globale » du tableau de bord.
 */
import { CONFORMITY_CATEGORIES, type ConformityCategory } from "@/lib/constantes";
import { prisma } from "@/server/db";

const KEY_CONFORMITY = "conformity_categories";

/** Liste ordonnée des catégories comptées dans la conformité globale. Défaut : toutes. */
export async function getConformityCategories(): Promise<ConformityCategory[]> {
  const s = await prisma.setting.findUnique({ where: { key: KEY_CONFORMITY } });
  if (!s?.value) return [...CONFORMITY_CATEGORIES];
  try {
    const saved = new Set(JSON.parse(s.value) as string[]);
    return CONFORMITY_CATEGORIES.filter((c) => saved.has(c));
  } catch {
    return [...CONFORMITY_CATEGORIES];
  }
}

/** Enregistre la sélection (liste de catégories valides). */
export async function setConformityCategories(categories: string[]): Promise<ConformityCategory[]> {
  const chosen = new Set(categories ?? []);
  const clean = CONFORMITY_CATEGORIES.filter((c) => chosen.has(c));
  await prisma.setting.upsert({
    where: { key: KEY_CONFORMITY },
    update: { value: JSON.stringify(clean) },
    create: { key: KEY_CONFORMITY, value: JSON.stringify(clean) },
  });
  return clean;
}
